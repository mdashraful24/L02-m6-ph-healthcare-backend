import { Document } from "@langchain/core/documents";
import { DoctorVerificationStatus } from "../../../generated/prisma/browser";
import { prisma } from "../../lib/prisma";
import { vectorStore } from "../../lib/vectorStore";

const INDEX_BATCH_SIZE = 20;

const indexableDoctorSelect = {
    id: true,
    name: true,
    specialization: true,
    qualifications: true,
    experienceYears: true,
    bio: true,
} as const;

type TIndexableDoctor = {
    id: string;
    name: string;
    specialization: string;
    qualifications: string;
    experienceYears: number;
    bio: string | null;
}

export const buildDoctorDocument = (doctor: TIndexableDoctor) =>
    new Document({
        pageContent: [
            `Doctor Name: ${doctor.name}`,
            `Specialization: ${doctor.specialization}`,
            `Qualifications: ${doctor.qualifications}`,
            `Experience: ${doctor.experienceYears} years`,
            `Bio: ${doctor.bio ?? "No bio available."}`
        ]
            .filter(Boolean)
            .join("\n"),
        metadata: {
            doctorId: doctor.id,
        },
    })

export const upsertDoctorEmbedding = async (doctorId: string) => {
    const doctor = await prisma.doctor.findUnique({
        where: { id: doctorId },
        select: {
            ...indexableDoctorSelect,
            isDeleted: true,
            verificationStatus: true,
        },
    });

    await vectorStore.delete({
        ids: [doctorId],
    })

    if (!doctor || doctor.isDeleted || doctor.verificationStatus !== DoctorVerificationStatus.VERIFIED) {
        return;
    }

    await vectorStore.addDocuments([
        buildDoctorDocument(doctor as TIndexableDoctor)
    ], {
        ids: [doctor.id],
    });
}

export const reIndexAllDoctors = async () => {
    const doctors = await prisma.doctor.findMany({
        where: {
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.VERIFIED,
        }
    });

    await prisma.doctorEmbedding.deleteMany({
        where: {
            id: {
                notIn: doctors.map(doctor => doctor.id)
            }
        }
    });

    for (let i = 0; i < doctors.length; i += INDEX_BATCH_SIZE) {
        const batch = doctors.slice(i, i + INDEX_BATCH_SIZE);
        const ids = batch.map(doctor => doctor.id);

        await vectorStore.delete({ ids });
        await vectorStore.addDocuments(batch.map(buildDoctorDocument), { ids });
    }

    return doctors.length;
}
