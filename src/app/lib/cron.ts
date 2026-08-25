import cron from 'node-cron';
import { DoctorVerificationStatus, Role } from '../../generated/prisma/enums';
import { prisma } from './prisma';

export const deleteUnverifiedDoctors = async () => {
    cron.schedule("*/10 * * * *", async () => {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

            const deletedDoctors = await prisma.user.deleteMany({
                where: {
                    role: Role.DOCTOR,
                    emailVerified: false,
                    createdAt: { lt: oneHourAgo },
                    doctor: {
                        verificationStatus: DoctorVerificationStatus.PENDING
                    }
                }
            });

            if (deletedDoctors.count > 0) {
                console.log(`Cron Job: Deleted ${deletedDoctors.count} unverified doctor(s) who registered more than an hour ago.`);
            }
        } catch (error) {
            console.error("Cron Job: Error while deleting unverified doctors:", error);
        }

        console.log("Doctor delete cron schedule (every 10 minutes)");
    });
};
