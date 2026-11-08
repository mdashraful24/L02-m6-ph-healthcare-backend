import cron from "node-cron";
import { DoctorVerificationStatus, Role } from "../../generated/prisma/enums";
import { prisma } from "./prisma";
import { reIndexAllDoctors } from "../module/chat/chat.indexer";

export const deleteUnverifiedDoctors = async () => {
	cron.schedule("*/30 * * * *", async () => {
		try {
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

			const deletedDoctors = await prisma.user.deleteMany({
				where: {
					role: Role.DOCTOR,
					emailVerified: false,
					createdAt: { lt: oneHourAgo },
					doctor: {
						verificationStatus: DoctorVerificationStatus.PENDING,
					},
				},
			});

			if (deletedDoctors.count > 0) {
				console.log(
					`Cron Job: Deleted ${deletedDoctors.count} unverified doctor(s) who registered more than an hour ago.`,
				);
			}
		} catch (error) {
			console.error(
				"Cron Job: Error while deleting unverified doctors:",
				error,
			);
		}

		console.log("Doctor delete cron schedule (every 10 minutes)");
	});
};

export const reindexDoctorEmbeddings = async () => {
	cron.schedule("0 3 * * *", async () => {
		try {
			const count = await reIndexAllDoctors();
			console.log(`Cron: re-index ${count} doctors for the chatbot`);
		} catch (error) {
			console.error(
				"Cron Job: failed to re-index doctor for the chatbot",
				error,
			);
		}
	});
};
