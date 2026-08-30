import type { UploadApiResponse } from "cloudinary";
import { format } from "date-fns";
import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";
import PDFDocument from "pdfkit";
import { AppointmentStatus, Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { ICreatedPrescriptionPayload } from "./prescription.interface";

const createPrescription = async (
	payload: ICreatedPrescriptionPayload,
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
			id: payload.appointmentId,
			doctorId: doctor.id,
		},
		include: {
			patient: true,
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}

	if (appointment.status !== AppointmentStatus.COMPLETED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Prescription can only be written for a completed appointment.",
		);
	}

	if (appointment.prescriptionUrl) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Prescription already exists for this appointment.",
		);
	}

	// ==========================================
	// Create PDF
	// ==========================================
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

	//pdf contents

	// pdfDocument.fontSize(20).text("PH Healthcare System", { align: "center" });
	// pdfDocument.fontSize(14).text("Prescription", { align: "center" });
	// pdfDocument.moveDown(2);

	// pdfDocument.fontSize(12).text(`Patient Name: ${appointment.patient.name}`);
	// pdfDocument.text(`Doctor Name: ${doctor.name}`);
	// pdfDocument.text(`Specialization: ${doctor.specialization}`);
	// pdfDocument.text(`Date: ${new Date().toDateString()}`);
	// pdfDocument.moveDown();

	// pdfDocument.fontSize(14).text("Findings");
	// pdfDocument.fontSize(12).text(payload.findings);
	// pdfDocument.moveDown();

	// pdfDocument.fontSize(14).text("Medicines");
	// pdfDocument.moveDown(0.5);

	// for (let i = 0; i < payload.medicines.length; i++) {
	//     const medicine = payload.medicines[i];

	//     pdfDocument.fontSize(12).text(`${i + 1}. ${medicine.name}`);
	//     pdfDocument.text(`   Dosage: ${medicine.dosage}`);
	//     pdfDocument.text(`   Duration: ${medicine.duration}`);

	//     if (medicine.instructions) {
	//         pdfDocument.text(`   Instructions: ${medicine.instructions}`);
	//     }

	//     pdfDocument.moveDown(0.5);
	// }

	// ==========================================
	// Colors
	// ==========================================
	const primaryColor = "#2563eb";
	const darkColor = "#0f172a";
	const textColor = "#475569";
	const lightColor = "#f8fafc";
	const borderColor = "#e2e8f0";

	// ==========================================
	// Header
	// ==========================================
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

	// ==========================================
	// Prescription Title
	// ==========================================
	pdfDocument
		.fontSize(22)
		.font("Helvetica-Bold")
		.fillColor(darkColor)
		.text("MEDICAL PRESCRIPTION", {
			align: "center",
		});

	pdfDocument.moveDown(0.8);

	// ==========================================
	// Prescription Information
	// ==========================================
	const prescriptionDate = format(new Date(), "dd MMMM yyyy");

	pdfDocument
		.fontSize(10)
		.font("Helvetica")
		.fillColor(textColor)
		.text(`Prescription Date: ${prescriptionDate}`, 50, pdfDocument.y);

	pdfDocument.text(`Appointment ID: ${appointment.id}`, {
		align: "right",
	});

	pdfDocument.moveDown(1);

	// ==========================================
	// Horizontal Line
	// ==========================================
	pdfDocument
		.moveTo(50, pdfDocument.y)
		.lineTo(545, pdfDocument.y)
		.lineWidth(1)
		.strokeColor(borderColor)
		.stroke();

	pdfDocument.moveDown(1.5);

	// ==========================================
	// Doctor Information
	// ==========================================
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
		.text(`Doctor Name: ${doctor.name}`)
		.text(`Specialization: ${doctor.specialization}`);

	pdfDocument.moveDown(1.5);

	// ==========================================
	// Patient Information
	// ==========================================
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

	// ==========================================
	// Findings
	// ==========================================
	pdfDocument
		.fontSize(13)
		.font("Helvetica-Bold")
		.fillColor(darkColor)
		.text("CLINICAL FINDINGS");

	pdfDocument.moveDown(0.5);

	pdfDocument
		.fontSize(10)
		.font("Helvetica")
		.fillColor(textColor)
		.text(payload.findings, {
			width: 495,
			align: "left",
		});

	pdfDocument.moveDown(1.5);

	// ==========================================
	// Medicines
	// ==========================================
	pdfDocument
		.fontSize(13)
		.font("Helvetica-Bold")
		.fillColor(darkColor)
		.text("PRESCRIBED MEDICINES");

	pdfDocument.moveDown(0.7);

	// ==========================================
	// Medicine Table
	// ==========================================
	const tableX = 50;
	const tableWidth = 495;

	const colMedicine = 65;
	const colDosage = 280;
	const colDuration = 370;
	const colInstruction = 455;

	const tableTop = pdfDocument.y;

	// Table Header

	pdfDocument.rect(tableX, tableTop, tableWidth, 32).fill(primaryColor);

	pdfDocument
		.fontSize(9)
		.font("Helvetica-Bold")
		.fillColor("#ffffff")
		.text("MEDICINE", colMedicine, tableTop + 10)
		.text("DOSAGE", colDosage, tableTop + 10)
		.text("DURATION", colDuration, tableTop + 10)
		.text("INSTRUCTIONS", colInstruction, tableTop + 10);

	// ==========================================
	// Medicine Rows
	// ==========================================
	let currentY = tableTop + 32;

	payload.medicines.forEach((medicine, index) => {
		const rowHeight = 45;

		// Alternate row background
		if (index % 2 === 0) {
			pdfDocument
				.rect(tableX, currentY, tableWidth, rowHeight)
				.fill(lightColor);
		}

		// Row border
		pdfDocument
			.rect(tableX, currentY, tableWidth, rowHeight)
			.lineWidth(0.5)
			.strokeColor(borderColor)
			.stroke();

		// Medicine name

		pdfDocument
			.fontSize(8)
			.font("Helvetica-Bold")
			.fillColor(darkColor)
			.text(medicine.name, colMedicine, currentY + 10, {
				width: 200,
			});

		// Dosage

		pdfDocument
			.fontSize(8)
			.font("Helvetica")
			.fillColor(textColor)
			.text(medicine.dosage, colDosage, currentY + 10, {
				width: 75,
			});

		// Duration

		pdfDocument.text(medicine.duration, colDuration, currentY + 10, {
			width: 75,
		});

		// Instructions

		pdfDocument.text(
			medicine.instructions || "As directed",
			colInstruction,
			currentY + 10,
			{
				width: 80,
			},
		);

		currentY += rowHeight;
	});

	// Move document cursor after table

	pdfDocument.y = currentY + 25;

	// ==========================================
	// Advice
	// ==========================================
	pdfDocument
		.fontSize(13)
		.font("Helvetica-Bold")
		.fillColor(darkColor)
		.text("GENERAL ADVICE");

	pdfDocument.moveDown(0.5);

	pdfDocument
		.fontSize(10)
		.font("Helvetica")
		.fillColor(textColor)
		.text("• Take medicines exactly as prescribed by the doctor.")
		.text("• Follow the prescribed dosage and duration.")
		.text("• Contact your doctor if you experience any unusual symptoms.");

	pdfDocument.moveDown(2);

	// ==========================================
	// Doctor Signature
	// ==========================================
	const signatureY = pdfDocument.y;

	pdfDocument
		.moveTo(380, signatureY + 25)
		.lineTo(535, signatureY + 25)
		.lineWidth(1)
		.strokeColor(borderColor)
		.stroke();

	pdfDocument
		.fontSize(9)
		.font("Helvetica")
		.fillColor(textColor)
		.text("Doctor's Signature", 380, signatureY + 32, {
			width: 155,
			align: "center",
		});

	pdfDocument
		.fontSize(10)
		.font("Helvetica-Bold")
		.fillColor(darkColor)
		.text(doctor.name, 380, signatureY + 50, {
			width: 155,
			align: "center",
		});

	// ==========================================
	// Footer
	// ==========================================
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

	pdfDocument
		.fontSize(8)
		.fillColor("#94a3b8")
		.text("This is a computer-generated prescription.", 50, 775, {
			width: 495,
			align: "center",
		});

	// ==========================================
	// Finish PDF
	// ==========================================
	pdfDocument.end();

	const pdfBuffer = await pdfReadyPromise;

	// ==========================================
	// Save PDF
	const uploadResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{ resource_type: "raw", format: "pdf" },
					(error, result) => {
						if (error) {
							return reject(error);
						}

						if (!result) {
							return reject(
								new AppError(
									httpStatus.INTERNAL_SERVER_ERROR,
									"Failed to upload prescription PDF from Cloudinary.",
								),
							);
						}
						resolve(result);
					},
				)
				.end(pdfBuffer);
		},
	);

	const updatedAppointment = await prisma.appointment.update({
		where: {
			id: appointment.id,
		},
		data: {
			prescriptionUrl: uploadResult.secure_url,
			prescriptionPublicId: uploadResult.public_id,
		},
	});

	// Send email to patient with prescription PDF attachment
	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/prescription.ejs",
	);

	const templateData = {
		patientName: appointment.patient.name,
		doctorName: doctor.name,
		specialization: doctor.specialization,
		prescriptionDate: format(new Date(), "dd MMMM yyyy"),
		appointmentId: appointment.id,
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: appointment.patient.email,
		subject: "Your Medical Prescription - PH Healthcare Management System",
		html,
		attachments: [
			{
				filename: `prescription-${appointment.id}.pdf`,
				content: pdfBuffer,
				contentType: "application/pdf",
			},
		],
	});

	return updatedAppointment;
};

const getSinglePrescription = async (
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
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
	}

	if (user.role === Role.PATIENT) {
		if (appointment.patient.userId !== user.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Yor are not authorized to view this prescription",
			);
		}
	}

	if (user.role === Role.DOCTOR) {
		if (appointment.doctor.userId !== user.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view this prescription",
			);
		}
	}

	if (!appointment.prescriptionUrl) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Prescription has not been written for this appointment yet",
		);
	}

	return {
		appointment,
		prescription: appointment.prescriptionUrl,
	};
};

export const PrescriptionService = {
	createPrescription,
	getSinglePrescription,
};
