import {
	addMinutes,
	format,
	isBefore,
	isSameDay,
	subHours,
	subMinutes,
} from "date-fns";
import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";
import PDFDocument from "pdfkit";
import {
	AppointmentStatus,
	PaymentStatus,
	Role,
	ScheduleStatus,
} from "../../../generated/prisma/enums";
import type { AppointmentWhereInput } from "../../../generated/prisma/models";
import config from "../../config";
import type { IQuery } from "../../interfaces";
import { getBkashIdToken } from "../../lib/bkash";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type {
	IBookAppointmentPayload,
	ICancelAppointmentPayload,
	IPayAppointmentPayload,
	IUpdateAppointmentPayload,
} from "./appointment.interface";

const bookAppointment = async (
	payload: IBookAppointmentPayload,
	user: RequestUser,
) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const patient = await tx.patient.findUnique({
			where: {
				userId: user.userId,
			},
		});

		if (!patient) {
			throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
		}

		const schedule = await tx.schedule.findUnique({
			where: {
				id: payload.scheduleId,
			},
			include: {
				doctor: true,
			},
		});

		if (!schedule) {
			throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");
		}

		if (schedule.status !== ScheduleStatus.PUBLISHED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This schedule is not published yet.",
			);
		}

		const now = new Date();

		if (!isSameDay(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This schedule is not available for booking today.",
			);
		}

		// if (!isBefore(now, schedule.startDateTime)) {
		// 	throw new AppError(
		// 		httpStatus.BAD_REQUEST,
		// 		"This schedule has already started and is not available for booking.",
		// 	);
		// }

		const bookingDeadline = subMinutes(
			schedule.startDateTime,
			config.booking_cutoff_minutes,
		);

		if (!isBefore(now, bookingDeadline)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Booking for this schedule closed at ${format(
					bookingDeadline,
					"hh:mm a",
				)}. Please book another day.`,
			);
		}

		const existingAppointment = await tx.appointment.findFirst({
			where: {
				patientId: patient.id,
				scheduleId: schedule.id,
				// status: {
				// 	in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
				// },
			},
		});

		if (existingAppointment?.status === AppointmentStatus.PENDING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You already have a pending appointment for this schedule.",
			);
		}

		if (existingAppointment?.status === AppointmentStatus.CONFIRMED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You already have a confirmed appointment for this schedule.",
			);
		}

		if (existingAppointment?.status === AppointmentStatus.ONGOING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You already have an ongoing appointment for this schedule. Please complete that appointment before booking a new one or try another day.",
			);
		}

		if (existingAppointment?.status === AppointmentStatus.COMPLETED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You already have a completed appointment for this schedule. Please try another day.",
			);
		}

		if (schedule.availableSlots === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"No available slots for this schedule. Please try another day.",
			);
		}

		if (!schedule.doctor.consultationFee) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Consultation fee is not set for this doctor.",
			);
		}

		const amount = schedule.doctor.consultationFee.toString();

		const appointment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
				patientId: patient.id,
				doctorId: schedule.doctor.id,
				scheduleId: schedule.id,
			},
		});

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(httpStatus.BAD_REQUEST, "No bKash access token found");
		}

		const bkashCreatePaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/create`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					mode: "0011",
					// payerReference: "01723888888", // user email or phone number can be used as payerReference
					payerReference: user.email,
					callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
					amount: amount,
					currency: "BDT",
					intent: "sale",
					// merchantInvoiceNumber: "Inv0124" // appointment id can be used as merchantInvoiceNumber
					merchantInvoiceNumber: appointment.id,
				}),
			},
		);

		const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

		// payment model create
		await tx.payment.create({
			data: {
				merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
				appointmentId: appointment.id,
				amount: amount,
				gatewayResponse: bkashCreatePaymentResult,
				bkashPaymentId: bkashCreatePaymentResult.paymentID,
				payerReference: user.email,
			},
		});

		// console.log({ bkashCreatePaymentResult });

		return {
			paymentUrl: bkashCreatePaymentResult.bkashURL,
		};
	});

	return transactionResult;
};

const payAppointment = async (
	payload: IPayAppointmentPayload,
	user: RequestUser,
) => {
	const appointmentId = payload.appointmentId;

	const existingAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			schedule: {
				include: {
					doctor: true,
				},
			},
		},
	});

	if (!existingAppointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}

	if (existingAppointment.status !== AppointmentStatus.PENDING) {
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment is not pending");
	}

	// if(existingAppointment.status === AppointmentStatus.CANCELLED || existingAppointment.status === AppointmentStatus.ONGOING || existingAppointment.status === AppointmentStatus.COMPLETED) {
	//     throw new Error(`Appointment is already ${existingAppointment.status.toLowerCase()} and cannot be paid`);
	// }

	if (!existingAppointment.schedule.doctor.consultationFee) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Consultation fee is not set for this doctor.",
		);
	}

	const amount = existingAppointment.schedule.doctor.consultationFee.toString();

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(httpStatus.BAD_REQUEST, "No bKash access token found");
	}

	const bkashCreatePaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				mode: "0011",
				// payerReference: "01723888888", // user email or phone number can be used as payerReference
				payerReference: user.email,
				callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
				amount: amount,
				currency: "BDT",
				intent: "sale",
				// merchantInvoiceNumber: "Inv0124" // appointment id can be used as merchantInvoiceNumber
				merchantInvoiceNumber: existingAppointment.id,
			}),
		},
	);

	const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

	await prisma.payment.update({
		where: {
			appointmentId: existingAppointment.id,
		},
		data: {
			merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
			bkashPaymentId: bkashCreatePaymentResult.paymentID,
			gatewayResponse: bkashCreatePaymentResult,
		},
	});

	return {
		paymentUrl: bkashCreatePaymentResult.bkashURL,
	};
};

const bookAppointmentCallback = async (query: Record<string, any>) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const paymentId = query.paymentID;

		if (!paymentId) {
			throw new AppError(httpStatus.BAD_REQUEST, "Payment id missing");
		}

		const status = query.status;

		if (!status) {
			throw new AppError(httpStatus.BAD_REQUEST, "Payment status is missing");
		}

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(httpStatus.BAD_REQUEST, "No bKash access token found");
		}

		const executedPaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/execute`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					paymentID: paymentId,
				}),
			},
		);

		const executedPaymentResult = await executedPaymentResponse.json();

		if (status === "success") {
			const appointment = await tx.appointment.findUnique({
				where: {
					id: executedPaymentResult.merchantInvoiceNumber,
				},
				include: {
					schedule: true,
					patient: true,
					doctor: true,
				},
			});

			if (!appointment) {
				throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
			}

			const alreadyBookedSlots =
				appointment.schedule.totalSlots - appointment.schedule.availableSlots;

			const serialNumber = alreadyBookedSlots + 1;

			const joiningTime = addMinutes(
				appointment.schedule.startDateTime,
				(serialNumber - 1) * 20,
			);

			await tx.appointment.update({
				where: {
					id: executedPaymentResult.merchantInvoiceNumber,
				},
				data: {
					status: AppointmentStatus.CONFIRMED,
					joiningTime,
					serialNumber,
				},
			});

			const newAvailableSlots = appointment.schedule.availableSlots - 1;

			await tx.schedule.update({
				where: {
					id: appointment.schedule.id,
				},
				data: {
					availableSlots: newAvailableSlots,
				},
			});

			await tx.payment.update({
				where: {
					appointmentId: executedPaymentResult.merchantInvoiceNumber,
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.PAID,
					bkashTrxId: executedPaymentResult.trxID,
					paidAt: executedPaymentResult.paymentExecuteTime,
					gatewayResponse: executedPaymentResult,
				},
			});

			// Generate Appointment Invoice PDF
			// const pdfDocument = new PDFDocument({ margin: 50 });

			// const pdfChunks: Buffer[] = [];

			// pdfDocument.on("data", (chunk: Buffer) => {
			// 	pdfChunks.push(chunk);
			// });

			// const pdfReadyPromise = new Promise<Buffer>((resolve) => {
			// 	pdfDocument.on("end", () => {
			// 		resolve(Buffer.concat(pdfChunks));
			// 	});
			// });

			// pdfDocument.fontSize(20).text("PH Healthcare Management System", { align: "center" });
			// pdfDocument.fontSize(14).text("Appointment Confirmation Invoice", { align: "center" });
			// pdfDocument.moveDown(2);

			// pdfDocument.fontSize(12).text(`Patient Name: ${appointment.patient.name}`);
			// pdfDocument.text(`Patient Email: ${appointment.patient.email}`);
			// pdfDocument.moveDown(2);

			// pdfDocument.fontSize(12).text(`Doctor Name: ${appointment.doctor.name}`);
			// pdfDocument.text(`Specialization: ${appointment.doctor.specialization}`);
			// pdfDocument.moveDown(2);

			// pdfDocument.text(`Appointment Date: ${format(appointment.schedule.startDateTime, "dd MMMM yyyy")}`);
			// pdfDocument.text(`Schedule Time: ${format(appointment.schedule.startDateTime, "hh:mm a")} - ${format(appointment.schedule.endDateTime, "hh:mm a")}`);
			// pdfDocument.text(`Joining Time: ${format(joiningTime, "hh:mm a")}`);
			// pdfDocument.fontSize(11).text("Meeting Line");
			// pdfDocument.fontSize(10).fillColor("#2563eb").text(appointment.schedule.meetingLink, { link: appointment.schedule.meetingLink, underline: true });
			// pdfDocument.text(`Serial Number: ${serialNumber}`);
			// pdfDocument.moveDown(2);

			// pdfDocument.text(`Amount Paid: ${executedPaymentResult.amount} BDT`);
			// pdfDocument.text("Payment Method: bKash");
			// pdfDocument.text(`Transaction ID: ${executedPaymentResult.trxID}`);
			// pdfDocument.text(`Paid At: ${executedPaymentResult.paymentExecuteTime}`);
			// pdfDocument.moveDown(2);

			// pdfDocument.text("Thank you for using PH Healthcare Management System!", { align: "center" });

			// pdfDocument.end();

			// const pdfBuffer = await pdfReadyPromise;

			// ================================
			// Generate Appointment Invoice PDF
			// ================================
			const pdfDocument = new PDFDocument({
				margin: 50,
				size: "A4",
			});

			const pdfChunks: Buffer[] = [];

			pdfDocument.on("data", (chunk: Buffer) => {
				pdfChunks.push(chunk);
			});

			const pdfReadyPromise = new Promise<Buffer>((resolve) => {
				pdfDocument.on("end", () => {
					resolve(Buffer.concat(pdfChunks));
				});
			});

			// ========================================
			// Colors
			// ========================================
			const primaryColor = "#2563eb";
			const darkColor = "#0f172a";
			const textColor = "#475569";
			const lightColor = "#f8fafc";
			const borderColor = "#e2e8f0";
			const successColor = "#16a34a";

			// ========================================
			// Header
			// ========================================
			pdfDocument
				.fontSize(22)
				.font("Helvetica-Bold")
				.fillColor(primaryColor)
				.text("PH HEALTHCARE", {
					align: "center",
				});

			pdfDocument
				.fontSize(10)
				.font("Helvetica")
				.fillColor(textColor)
				.text("Healthcare Management System", {
					align: "center",
				});

			pdfDocument.moveDown(1.5);

			// ========================================
			// Invoice Title
			// ========================================
			pdfDocument
				.fontSize(20)
				.font("Helvetica-Bold")
				.fillColor(darkColor)
				.text("APPOINTMENT INVOICE", {
					align: "center",
				});

			pdfDocument.moveDown(0.8);

			// ========================================
			// Invoice Information
			// ========================================
			const invoiceDate = format(new Date(), "dd MMMM yyyy");

			pdfDocument
				.fontSize(10)
				.font("Helvetica")
				.fillColor(textColor)
				.text(`Invoice ID: ${appointment.id}`, 50, pdfDocument.y);

			pdfDocument.text(`Invoice Date: ${invoiceDate}`, {
				align: "right",
			});

			pdfDocument.moveDown(1);

			// ========================================
			// Horizontal Line
			// ========================================
			pdfDocument
				.moveTo(50, pdfDocument.y)
				.lineTo(545, pdfDocument.y)
				.lineWidth(1)
				.strokeColor(borderColor)
				.stroke();

			pdfDocument.moveDown(1.5);

			// ========================================
			// Patient Information
			// ========================================
			pdfDocument
				.fontSize(13)
				.font("Helvetica-Bold")
				.fillColor(darkColor)
				.text("PATIENT INFORMATION");

			pdfDocument.moveDown(0.5);

			pdfDocument
				.fontSize(10)
				.font("Helvetica")
				.fillColor(textColor)
				.text(`Patient Name: ${appointment.patient.name}`)
				.text(`Patient Email: ${appointment.patient.email}`);

			pdfDocument.moveDown(1.5);

			// ========================================
			// Doctor Information
			// ========================================
			pdfDocument
				.fontSize(13)
				.font("Helvetica-Bold")
				.fillColor(darkColor)
				.text("DOCTOR INFORMATION");

			pdfDocument.moveDown(0.5);

			pdfDocument
				.fontSize(10)
				.font("Helvetica")
				.fillColor(textColor)
				.text(`Doctor Name: ${appointment.doctor.name}`)
				.text(`Specialization: ${appointment.doctor.specialization}`);

			pdfDocument.moveDown(1.5);

			// ========================================
			// Appointment Details
			// ========================================
			pdfDocument
				.fontSize(13)
				.font("Helvetica-Bold")
				.fillColor(darkColor)
				.text("APPOINTMENT DETAILS");

			pdfDocument.moveDown(0.5);

			pdfDocument
				.fontSize(10)
				.font("Helvetica")
				.fillColor(textColor)
				.text(
					`Appointment Date: ${format(
						appointment.schedule.startDateTime,
						"dd MMMM yyyy",
					)}`,
				)
				// .text(
				// 	`Schedule Time: ${format(
				// 		appointment.schedule.startDateTime,
				// 		"hh:mm a",
				// 	)} - ${format(appointment.schedule.endDateTime, "hh:mm a")}`,
				// )
				.text(`Joining Time: ${format(joiningTime, "hh:mm a")}`)
				.text(`Serial Number: #${serialNumber}`);

			pdfDocument.moveDown(0.7);

			// ========================================
			// Meeting Link
			// ========================================
			pdfDocument
				.fontSize(10)
				.font("Helvetica")
				.fillColor(textColor)
				.text("Meeting Link: ");

			const meetingLink = appointment.schedule.meetingLink;

			pdfDocument
				.fontSize(10)
				.font("Helvetica")
				.fillColor(primaryColor)
				.text("Join Appointment", {
					link: meetingLink,
					underline: true,
				});

			pdfDocument.moveDown(1.5);

			// ========================================
			// Payment Details
			// ========================================
			pdfDocument
				.fontSize(13)
				.font("Helvetica-Bold")
				.fillColor(darkColor)
				.text("PAYMENT DETAILS");

			pdfDocument.moveDown(0.7);

			// ========================================
			// Payment Table Header
			// ========================================
			const tableX = 50;
			const tableWidth = 495;
			const descriptionX = 65;
			const amountX = 430;

			const tableTop = pdfDocument.y;

			pdfDocument.rect(tableX, tableTop, tableWidth, 28).fill(primaryColor);

			pdfDocument
				.fontSize(10)
				.font("Helvetica-Bold")
				.fillColor("#ffffff")
				.text("DESCRIPTION", descriptionX, tableTop + 9);

			pdfDocument.text("AMOUNT", amountX, tableTop + 9, {
				width: 90,
				align: "right",
			});

			// ========================================
			// Payment Table Row
			// ========================================
			const rowTop = tableTop + 28;

			pdfDocument.rect(tableX, rowTop, tableWidth, 35).fill(lightColor);

			pdfDocument
				.fontSize(10)
				.font("Helvetica")
				.fillColor(textColor)
				.text("Doctor Appointment Fee", descriptionX, rowTop + 11);

			pdfDocument.text(
				`${executedPaymentResult.amount} BDT`,
				amountX,
				rowTop + 11,
				{
					width: 90,
					align: "right",
				},
			);

			// ========================================
			// Total
			// ========================================
			const totalTop = rowTop + 50;

			pdfDocument
				.fontSize(12)
				.font("Helvetica-Bold")
				.fillColor(darkColor)
				.text("TOTAL PAID", 350, totalTop);

			pdfDocument
				.fontSize(12)
				.font("Helvetica-Bold")
				.fillColor(successColor)
				.text(`${executedPaymentResult.amount} BDT`, amountX, totalTop, {
					width: 90,
					align: "right",
				});

			pdfDocument.moveDown(2);

			// ========================================
			// Payment Information
			// ========================================
			pdfDocument
				.fontSize(10)
				.font("Helvetica")
				.fillColor(textColor)
				.text("Payment Method: bKash")
				.text(`Transaction ID: ${executedPaymentResult.trxID}`)
				.text(`Paid At: ${executedPaymentResult.paymentExecuteTime}`);

			pdfDocument.moveDown(1);

			// ========================================
			// Payment Status
			// ========================================
			const statusY = pdfDocument.y;

			pdfDocument.roundedRect(180, statusY, 235, 35, 6).fill("#dcfce7");

			pdfDocument
				.fontSize(12)
				.font("Helvetica-Bold")
				.fillColor(successColor)
				.text("✓ PAYMENT SUCCESSFUL", 180, statusY + 11, {
					width: 235,
					align: "center",
				});

			pdfDocument.moveDown(3);

			// ========================================
			// Thank You Message
			// ========================================
			pdfDocument
				.fontSize(11)
				.font("Helvetica-Bold")
				.fillColor(darkColor)
				.text("Thank you for choosing PH Healthcare!", {
					align: "center",
				});

			pdfDocument.moveDown(0.5);

			pdfDocument
				.fontSize(9)
				.font("Helvetica")
				.fillColor(textColor)
				.text(
					"This is a computer-generated invoice and does not require a signature.",
					{
						width: 545,
						align: "center",
					},
				);

			// ========================================
			// Footer
			// ========================================
			pdfDocument
				.fontSize(8)
				.font("Helvetica")
				.fillColor("#94a3b8")
				.text(
					`© ${new Date().getFullYear()} PH Healthcare Management System. All rights reserved.`,
					50,
					760,
					{
						width: 495,
						align: "center",
					},
				);

			// ========================================
			// Finish PDF
			// ========================================
			pdfDocument.end();

			const pdfBuffer = await pdfReadyPromise;

			// Send Appointment Confirmation Email with PDF Attachment
			const templatePath = path.join(
				process.cwd(),
				"src/app/templates/appointment-confirmation.ejs",
			);

			const templateData = {
				name: appointment.patient.name,
				email: appointment.patient.email,
				doctorName: appointment.doctor.name,
				specialization: appointment.doctor.specialization,
				meetingLink: appointment.schedule.meetingLink,
				appointmentDate: format(
					appointment.schedule.startDateTime,
					"dd MMMM yyyy",
				),
				scheduleTime: `${format(
					appointment.schedule.startDateTime,
					"hh:mm a",
				)} - ${format(appointment.schedule.endDateTime, "hh:mm a")}`,
				joiningTime: format(joiningTime, "hh:mm a"),
				serialNumber,
			};

			const html = await ejs.renderFile(templatePath, templateData);

			await transporter.sendMail({
				from: config.email_sender,
				to: appointment.patient.email,
				subject: "Appointment Confirmed & Payment Receipt - PH Healthcare",
				html,
				attachments: [
					{
						filename: `appointment-invoice-${appointment.id}.pdf`,
						content: pdfBuffer,
						contentType: "application/pdf",
					},
				],
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
			};
		} else if (status === "failure") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.FAILED,
					gatewayResponse: executedPaymentResult,
				},
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
			};
		} else if (status === "cancel") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.CANCELLED,
					gatewayResponse: executedPaymentResult,
				},
			});

			return {
				executedPaymentResult,
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
			};
		} else {
			return {
				executedPaymentResult,
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment_failed`,
			};
		}
	}, {
		maxWait: 10000, // default is 2000
		timeout: 30000, // default is 5000
	});

	return transactionResult;
};

const cancelAppointment = async (
	payload: ICancelAppointmentPayload,
	user: RequestUser,
) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const appointmentId = payload.appointmentId;

		const existingAppointment = await tx.appointment.findUnique({
			where: {
				id: appointmentId,
				patient: {
					email: user.email,
				},
			},
			include: {
				payment: true,
				schedule: true,
			},
		});

		if (!existingAppointment) {
			throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
		}

		if (
			existingAppointment.status === AppointmentStatus.ONGOING ||
			existingAppointment.status === AppointmentStatus.COMPLETED
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Appointment is ongoing or completed",
			);
		}

		if (existingAppointment.status === AppointmentStatus.CANCELLED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Appointment already cancelled",
			);
		}

		const updatedAppointment = await tx.appointment.update({
			where: {
				id: existingAppointment.id,
			},
			data: {
				status: AppointmentStatus.CANCELLED,
			},
		});

		await tx.schedule.update({
			where: {
				id: existingAppointment.schedule.id,
			},
			data: {
				availableSlots: {
					increment: 1,
				},
			},
		});

		const now = new Date();
		const startDateTime = existingAppointment.schedule.startDateTime;
		const refundCutOffTime = subHours(startDateTime, 1); // 1 hour before the schedule start time
		const isEligibleForRefund = isBefore(now, refundCutOffTime);

		if (isEligibleForRefund) {
			const bkashIdToken = await getBkashIdToken();

			if (!bkashIdToken) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"No bKash access token found",
				);
			}

			const bkashRefundPaymentResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						Authorization: bkashIdToken,
						"X-App-Key": config.bkash_app_key,
					},
					body: JSON.stringify({
						paymentID: existingAppointment.payment?.bkashPaymentId,
						trxID: existingAppointment.payment?.bkashTrxId,
						amount: existingAppointment.payment?.amount.toString(),
						sku: "Appointment Cancellation",
						reason: "Patient cancelled the appointment",
					}),
				},
			);

			const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();

			// console.log({ bkashRefundPaymentResult }, "bkashRefundPaymentResult");

			await tx.payment.update({
				where: {
					appointmentId: existingAppointment.id,
				},
				data: {
					refundTrxId: bkashRefundPaymentResult.refundTrxID,
					refundAt: bkashRefundPaymentResult.completedTime,
					refundAmount: bkashRefundPaymentResult.amount,
					refundReason: "Patient cancelled the appointment",
					status: PaymentStatus.REFUNDED,
					gatewayResponse: bkashRefundPaymentResult,
				},
			});
		}

		const newPaymentInfo = await tx.payment.findUnique({
			where: {
				appointmentId: existingAppointment.id,
			},
		});

		return {
			appointment: updatedAppointment,
			payment: newPaymentInfo,
		};
	});

	return transactionResult;
};

// Doctor only can update the appointment status CONFIRMED => ONGOING => COMPLETED
const updateAppointmentStatus = async (
	appointmentId: string,
	payload: IUpdateAppointmentPayload,
	user: RequestUser,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}

	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
			doctorId: doctor.id,
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}

	if (appointment.status === AppointmentStatus.COMPLETED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Appointment is already completed and cannot be updated.",
		);
	}

	if (appointment.status === AppointmentStatus.CANCELLED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Appointment is cancelled and cannot be updated.",
		);
	}

	if (appointment.status === AppointmentStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Appointment is pending. Please wait for the patient to complete the payment and confirm the appointment before updating the status.",
		);
	}

	if (appointment.status === AppointmentStatus.CONFIRMED) {
		if (payload.status !== AppointmentStatus.ONGOING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Confirmed appointment must be ongoing at first.",
			);
		}

		await prisma.appointment.update({
			where: {
				id: appointment.id,
			},
			data: {
				status: AppointmentStatus.ONGOING,
			},
		});
	}

	if (appointment.status === AppointmentStatus.ONGOING) {
		if (payload.status !== AppointmentStatus.COMPLETED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Ongoing appointment must be complete.",
			);
		}

		await prisma.appointment.update({
			where: {
				id: appointment.id,
			},
			data: {
				status: AppointmentStatus.COMPLETED,
			},
		});
	}

	const updatedAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointment.id,
		},
	});

	return updatedAppointment;
};

// Patient appointments
const getMyAppointments = async (query: IQuery, user: RequestUser) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const patient = await prisma.patient.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!patient) {
		throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
	}

	const andConditions: AppointmentWhereInput[] = [
		{
			patientId: patient.id,
		},
	];

	if (query.status) {
		andConditions.push({
			status: query.status as AppointmentStatus,
		});
	}

	const where: AppointmentWhereInput = {
		AND: andConditions,
	};

	const appointments = await prisma.appointment.findMany({
		where,
		skip,
		take: limit,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			patient: {
				select: {
					id: true,
					name: true,
					email: true,
					contactNumber: true,
				},
			},
			doctor: true,
			schedule: true,
			payment: true,
		},
	});

	const totalAppointments = await prisma.appointment.count({
		where,
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total: totalAppointments,
			totalPages: Math.ceil(totalAppointments / limit),
		},
	};
};

// Doctor appointments
const getMyDoctorAppointments = async (query: IQuery, user: RequestUser) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}

	const andConditions: AppointmentWhereInput[] = [
		{
			doctorId: doctor.id,
		},
	];

	if (query.status) {
		andConditions.push({
			status: query.status as AppointmentStatus,
		});
	}

	const where: AppointmentWhereInput = {
		AND: andConditions,
	};

	const appointments = await prisma.appointment.findMany({
		where,
		skip,
		take: limit,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			patient: {
				select: {
					id: true,
					name: true,
					email: true,
					contactNumber: true,
				},
			},
			schedule: true,
			payment: true,
		},
	});

	const totalAppointments = await prisma.appointment.count({
		where,
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total: totalAppointments,
			totalPages: Math.ceil(totalAppointments / limit),
		},
	};
};

// Admin Super Admin appointments
const getAllAppointments = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: AppointmentWhereInput[] = [];

	if (query.status) {
		andConditions.push({
			status: query.status as AppointmentStatus,
		});
	}

	if (query.doctorId) {
		andConditions.push({
			doctorId: query.doctorId,
		});
	}

	if (query.patientId) {
		andConditions.push({
			patientId: query.patientId,
		});
	}

	if (query.doctorName) {
		andConditions.push({
			doctor: {
				name: {
					contains: query.doctorName,
					mode: "insensitive",
				},
			},
		});
	}

	if (query.doctorEmail) {
		andConditions.push({
			doctor: {
				email: query.doctorEmail,
			},
		});
	}

	if (query.doctorContactNumber) {
		andConditions.push({
			doctor: {
				contactNumber: query.doctorContactNumber,
			},
		});
	}

	if (query.patientName) {
		andConditions.push({
			patient: {
				name: {
					contains: query.patientName,
					mode: "insensitive",
				},
			},
		});
	}

	if (query.patientEmail) {
		andConditions.push({
			patient: {
				email: query.patientEmail,
			},
		});
	}

	if (query.patientContactNumber) {
		andConditions.push({
			patient: {
				contactNumber: query.patientContactNumber,
			},
		});
	}

	const where: AppointmentWhereInput = {
		AND: andConditions,
	};

	const appointments = await prisma.appointment.findMany({
		where,
		skip,
		take: limit,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			patient: {
				select: {
					id: true,
					name: true,
					email: true,
					contactNumber: true,
				},
			},
			doctor: {
				select: {
					id: true,
					name: true,
					email: true,
					contactNumber: true,
					specialization: true,
				},
			},
			schedule: true,
			payment: true,
		},
	});

	const totalAppointments = await prisma.appointment.count({
		where,
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total: totalAppointments,
			totalPages: Math.ceil(totalAppointments / limit),
		},
	};
};

// Single appointment details
const getSingleAppointmentDetails = async (
	appointmentId: string,
	user: RequestUser,
) => {
	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			patient: {
				select: {
					id: true,
					name: true,
					email: true,
					contactNumber: true,
					userId: true,
				},
			},
			doctor: {
				select: {
					id: true,
					name: true,
					email: true,
					contactNumber: true,
					specialization: true,
					userId: true,
				},
			},
			schedule: true,
			payment: true,
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}

	if (user.role === Role.PATIENT) {
		if (appointment.patient.userId !== user.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view this appointment",
			);
		}
	}

	if (user.role === Role.DOCTOR) {
		if (appointment.doctor.userId !== user.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view this appointment",
			);
		}
	}

	return appointment;
};

export const AppointmentServices = {
	bookAppointment,
	payAppointment,
	bookAppointmentCallback,
	cancelAppointment,
	updateAppointmentStatus,
	getMyAppointments,
	getMyDoctorAppointments,
	getAllAppointments,
	getSingleAppointmentDetails,
};
