import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import type { PaymentWhereInput } from "../../../generated/prisma/models";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

const getMyPayments = async (query: IQuery, user: RequestUser) => {
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

	const andConditions: PaymentWhereInput[] = [
		{
			appointment: {
				patientId: patient.id,
			},
		},
	];

	if (query.searchTerm) {
		andConditions.push({
			appointment: {
				OR: [
					{
						doctor: {
							name: {
								contains: query.searchTerm,
								mode: "insensitive",
							},
						},
					},
					{
						doctor: {
							email: {
								contains: query.searchTerm,
								mode: "insensitive",
							},
						},
					},
					{
						doctor: {
							specialization: {
								contains: query.searchTerm,
								mode: "insensitive",
							},
						},
					},
				],
			},
		});
	}

	const payments = await prisma.payment.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip: skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			appointment: {
				include: {
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
				},
			},
		},
	});

	const totalPayments = await prisma.payment.count({
		where: {
			AND: andConditions,
		},
	});

	return {
		data: payments,
		meta: {
			page,
			limit,
			total: totalPayments,
			totalPages: Math.ceil(totalPayments / limit),
		},
	};
};

const getAllPayments = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: PaymentWhereInput[] = [];

	if (query.searchTerm) {
		andConditions.push({
			appointment: {
				OR: [
					{
						patient: {
							name: {
								contains: query.searchTerm,
								mode: "insensitive",
							},
						},
					},
					{
						patient: {
							email: {
								contains: query.searchTerm,
								mode: "insensitive",
							},
						},
					},
					{
						patient: {
							contactNumber: {
								contains: query.searchTerm,
								mode: "insensitive",
							},
						},
					},
				],
			},
		});
	}

	const payments = await prisma.payment.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip: skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			appointment: {
				include: {
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
				},
			},
		},
	});

	const totalPayments = await prisma.payment.count({
		where: {
			AND: andConditions,
		},
	});

	return {
		data: payments,
		meta: {
			page,
			limit,
			total: totalPayments,
			totalPages: Math.ceil(totalPayments / limit),
		},
	};
};

const getSinglePaymentDetails = async (
	paymentId: string,
	user: RequestUser,
) => {
	const payment = await prisma.payment.findUnique({
		where: {
			id: paymentId,
		},
		include: {
			appointment: {
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
						},
					},
					schedule: true,
				},
			},
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	if (user.role === Role.PATIENT) {
		if (payment.appointment.patient.userId !== user.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view this payment details",
			);
		}
	}

	return payment;
};

export const PaymentService = {
	getMyPayments,
	getAllPayments,
	getSinglePaymentDetails,
};
