import { Doctor, Prisma } from "../../../generated/prisma/client";
import { AuthProvider } from "../../../generated/prisma/enums";

export interface IAdditionalDocument {
    url: string;
    publicId: string;
}

export type IDoctor = Doctor;

export interface IApplyAsDoctor {
    user: {
        name: string;
        email: string;
        password?: string;
        // authProvider?: AuthProvider;
        imageUrl?: string;
    };

    doctor: Omit<
        Prisma.DoctorCreateWithoutUserInput,
        "name" | "email"
    >;
}
