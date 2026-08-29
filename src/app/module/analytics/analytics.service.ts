import httpStatus from 'http-status';
import { AppointmentStatus, DoctorVerificationStatus, PaymentStatus, ScheduleStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

const getPatientAnalytics = async (user: RequestUser) => {
    const patient = await prisma.user.findUnique({
        where: {
            id: user.userId,
        },
    });

    if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
    }

    const totalAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
        },
    });

    const totalPendingAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.PENDING,
        },
    });

    const totalConfirmedAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.CONFIRMED,
        },
    });

    const totalCancelledAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.CANCELLED,
        },
    });

    const totalOngoingAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.ONGOING,
        },
    });

    const totalCompletedAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.COMPLETED,
        },
    });

    // Revenue Analytics
    const totalAmountSpentResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id,
            },
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    });

    const totalAmountSpent = totalAmountSpentResult._sum.amount?.toNumber() || 0;

    const totalRefundedPaymentsResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id,
            },
            status: PaymentStatus.REFUNDED
        },
        _sum: {
            amount: true
        }
    });

    const totalRefunded = totalRefundedPaymentsResult._sum.amount?.toNumber() || 0;

    return {
        totalAppointments,
        totalPendingAppointments,
        totalConfirmedAppointments,
        totalCancelledAppointments,
        totalOngoingAppointments,
        totalCompletedAppointments,
        totalAmountSpent,
        totalRefunded
    };
};

const getDoctorAnalytics = async (user: RequestUser) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId,
        },
    });

    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }

    // Schedule Analytics
    const totalSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
        },
    });

    const totalPublishedSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            status: ScheduleStatus.PUBLISHED
        },
    });

    const totalDraftSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            status: ScheduleStatus.DRAFT
        },
    });

    // Appointment Analytics
    const totalAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
        },
    });

    const totalPendingAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.PENDING,
        },
    });

    const totalConfirmedAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.CONFIRMED,
        },
    });

    const totalCancelledAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.CANCELLED,
        },
    });

    const totalOngoingAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.ONGOING,
        },
    });

    const totalCompletedAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.COMPLETED,
        },
    });

    // Revenue Analytics
    const totalDoctorRefundedPaymentsResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,
            },
            status: PaymentStatus.REFUNDED
        },
        _sum: {
            amount: true
        }
    });

    const totalDoctorRefunded = totalDoctorRefundedPaymentsResult._sum.amount?.toNumber() || 0;

    const totalDoctorEarningsResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,
            },
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    });

    const totalDoctorEarnings = (totalDoctorEarningsResult._sum.amount?.toNumber() || 0) - totalDoctorRefunded;

    return {
        totalSchedules,
        totalPublishedSchedules,
        totalDraftSchedules,
        totalAppointments,
        totalPendingAppointments,
        totalConfirmedAppointments,
        totalCancelledAppointments,
        totalOngoingAppointments,
        totalCompletedAppointments,
        totalDoctorEarnings,
        totalDoctorRefunded
    };
};

const getAdminAnalytics = async () => {
    // Doctor Analytics
    const totalDoctors = await prisma.doctor.count({
        where: {
            isDeleted: false,
        },
    });

    const totalPendingDoctorApplications = await prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.PENDING,
        },
    });

    const totalRejectedDoctorApplications = await prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.REJECTED,
        },
    });

    const totalApprovedDoctorApplications = await prisma.doctor.count({
        where: {
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.VERIFIED,
        },
    });

    const totalDeletedDoctors = await prisma.doctor.count({
        where: {
            isDeleted: true,
        },
    });

    // Patient Analytics
    const totalPatients = await prisma.user.count({
        where: {
            isDeleted: false,
        },
    });

    // Appointment Analytics
    const totalAppointments = await prisma.appointment.count();

    const totalPendingAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.PENDING,
        },
    });

    const totalConfirmedAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.CONFIRMED,
        },
    });

    const totalCancelledAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.CANCELLED,
        },
    });

    const totalOngoingAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.ONGOING,
        },
    });

    const totalCompletedAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.COMPLETED,
        },
    });

    // Revenue Analytics
    const totalRefundedPaymentsResult = await prisma.payment.aggregate({
        where: {
            status: PaymentStatus.REFUNDED
        },
        _sum: {
            amount: true
        }
    });

    const totalRefunded = totalRefundedPaymentsResult._sum.amount?.toNumber() || 0;

    const totalRevenueResult = await prisma.payment.aggregate({
        where: {
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    });

    const totalRevenue = (totalRevenueResult._sum.amount?.toNumber() || 0) - totalRefunded;

    return {
        totalDoctors,
        totalPendingDoctorApplications,
        totalRejectedDoctorApplications,
        totalApprovedDoctorApplications,
        totalDeletedDoctors,
        totalPatients,
        totalAppointments,
        totalPendingAppointments,
        totalConfirmedAppointments,
        totalCancelledAppointments,
        totalOngoingAppointments,
        totalCompletedAppointments,
        totalRevenue,
        totalRefunded
    };
};

export const AnalyticsServices = {
    getAdminAnalytics,
    getDoctorAnalytics,
    getPatientAnalytics
};