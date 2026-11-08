import "dotenv/config";
import bcrypt from "bcryptjs";
import { Prisma } from "../../generated/prisma/client";
import {
	DoctorVerificationStatus,
	Role,
} from "../../generated/prisma/enums";
import logger from "../logger";
import { prisma } from "../lib/prisma";

const DOCTOR_SEED_PASSWORD =
	process.env.DOCTOR_SEED_PASSWORD ?? "Doctor@123";

type TSeedDoctor = {
	name: string;
	email: string;
	address: string;
	specialization: string;
	licenseNumber: string;
	qualifications: string;
	experienceYears: number;
	bio: string;
	consultationFee: number;
	contactNumber: string;
};

const doctors: TSeedDoctor[] = [
	{
		name: "Dr. Sarah Khan",
		email: "sarah.khan@phhealthcare.com",
		address: "House 12, Road 5, Dhanmondi, Dhaka",
		specialization: "Cardiology",
		licenseNumber: "BMDC-20001",
		qualifications: "MBBS, FCPS (Cardiology)",
		experienceYears: 12,
		bio: "Board-certified cardiologist specializing in preventive cardiology, heart failure management, and interventional procedures.",
		consultationFee: 2500,
		contactNumber: "+8801711000001",
	},
	{
		name: "Dr. Ahmed Rahman",
		email: "ahmed.rahman@phhealthcare.com",
		address: "House 7, Road 11, Banani, Dhaka",
		specialization: "Neurology",
		licenseNumber: "BMDC-20002",
		qualifications: "MBBS, MD (Neurology)",
		experienceYears: 10,
		bio: "Neurologist with expertise in stroke management, epilepsy, migraine, and neurodegenerative disorders.",
		consultationFee: 2200,
		contactNumber: "+8801711000002",
	},
	{
		name: "Dr. Fatima Akter",
		email: "fatima.akter@phhealthcare.com",
		address: "House 21, Road 3, Uttara, Dhaka",
		specialization: "Dermatology",
		licenseNumber: "BMDC-20003",
		qualifications: "MBBS, DDV (Dermatology)",
		experienceYears: 8,
		bio: "Dermatologist treating acne, eczema, psoriasis, hair loss, and cosmetic skin conditions.",
		consultationFee: 1500,
		contactNumber: "+8801711000003",
	},
	{
		name: "Dr. Mohammad Hasan",
		email: "mohammad.hasan@phhealthcare.com",
		address: "House 5, Road 8, Gulshan, Dhaka",
		specialization: "Orthopedics",
		licenseNumber: "BMDC-20004",
		qualifications: "MBBS, MS (Orthopedics)",
		experienceYears: 15,
		bio: "Orthopedic surgeon specializing in joint replacement, sports injuries, and fracture management.",
		consultationFee: 2000,
		contactNumber: "+8801711000004",
	},
	{
		name: "Dr. Nusrat Jahan",
		email: "nusrat.jahan@phhealthcare.com",
		address: "House 18, Road 10, Mirpur, Dhaka",
		specialization: "Pediatrics",
		licenseNumber: "BMDC-20005",
		qualifications: "MBBS, FCPS (Pediatrics)",
		experienceYears: 9,
		bio: "Pediatrician providing complete care for newborns, children, and adolescents including vaccination and growth monitoring.",
		consultationFee: 1200,
		contactNumber: "+8801711000005",
	},
	{
		name: "Dr. Imran Hossain",
		email: "imran.hossain@phhealthcare.com",
		address: "House 44, Road 2, Mohammadpur, Dhaka",
		specialization: "Gastroenterology",
		licenseNumber: "BMDC-20006",
		qualifications: "MBBS, MD (Gastroenterology)",
		experienceYears: 11,
		bio: "Gastroenterologist experienced in treating acid reflux, liver disease, inflammatory bowel disease, and endoscopy procedures.",
		consultationFee: 2000,
		contactNumber: "+8801711000006",
	},
	{
		name: "Dr. Ayesha Siddiqua",
		email: "ayesha.siddiqua@phhealthcare.com",
		address: "House 9, Road 14, Bashundhara R/A, Dhaka",
		specialization: "Endocrinology",
		licenseNumber: "BMDC-20007",
		qualifications: "MBBS, FCPS (Endocrinology)",
		experienceYears: 7,
		bio: "Endocrinologist specializing in diabetes, thyroid disorders, hormonal imbalance, and metabolic syndrome.",
		consultationFee: 1800,
		contactNumber: "+8801711000007",
	},
	{
		name: "Dr. Kamrul Islam",
		email: "kamrul.islam@phhealthcare.com",
		address: "House 31, Road 6, Baridhara, Dhaka",
		specialization: "Pulmonology",
		licenseNumber: "BMDC-20008",
		qualifications: "MBBS, FCPS (Pulmonology)",
		experienceYears: 14,
		bio: "Pulmonologist treating asthma, COPD, pneumonia, sleep apnea, and other respiratory conditions.",
		consultationFee: 2000,
		contactNumber: "+8801711000008",
	},
	{
		name: "Dr. Rezaul Karim",
		email: "rezaul.karim@phhealthcare.com",
		address: "House 16, Road 1, Motijheel, Dhaka",
		specialization: "Nephrology",
		licenseNumber: "BMDC-20009",
		qualifications: "MBBS, MD (Nephrology)",
		experienceYears: 13,
		bio: "Nephrologist specializing in chronic kidney disease, dialysis, kidney stones, and electrolyte disorders.",
		consultationFee: 2300,
		contactNumber: "+8801711000009",
	},
	{
		name: "Dr. Shirin Sultana",
		email: "shirin.sultana@phhealthcare.com",
		address: "House 27, Road 12, Banani, Dhaka",
		specialization: "Oncology",
		licenseNumber: "BMDC-20010",
		qualifications: "MBBS, FCPS (Oncology)",
		experienceYears: 16,
		bio: "Medical oncologist with extensive experience in chemotherapy, targeted therapy, and comprehensive cancer care.",
		consultationFee: 3000,
		contactNumber: "+8801711000010",
	},
	{
		name: "Dr. Tanvir Ahmed",
		email: "tanvir.ahmed@phhealthcare.com",
		address: "House 3, Road 4, Farmgate, Dhaka",
		specialization: "Psychiatry",
		licenseNumber: "BMDC-20011",
		qualifications: "MBBS, MD (Psychiatry)",
		experienceYears: 6,
		bio: "Psychiatrist treating depression, anxiety, bipolar disorder, and stress-related conditions with a patient-centered approach.",
		consultationFee: 1500,
		contactNumber: "+8801711000011",
	},
	{
		name: "Dr. Farhana Yasmin",
		email: "farhana.yasmin@phhealthcare.com",
		address: "House 23, Road 9, Uttara, Dhaka",
		specialization: "Ophthalmology",
		licenseNumber: "BMDC-20012",
		qualifications: "MBBS, FCPS (Ophthalmology)",
		experienceYears: 12,
		bio: "Ophthalmologist specializing in cataract surgery, glaucoma, diabetic retinopathy, and refractive errors.",
		consultationFee: 1800,
		contactNumber: "+8801711000012",
	},
	{
		name: "Dr. Rafiqul Alam",
		email: "rafiqul.alam@phhealthcare.com",
		address: "House 11, Road 7, Wari, Dhaka",
		specialization: "ENT",
		licenseNumber: "BMDC-20013",
		qualifications: "MBBS, MS (ENT)",
		experienceYears: 10,
		bio: "ENT specialist treating sinusitis, tonsillitis, hearing loss, vertigo, and voice disorders.",
		consultationFee: 1500,
		contactNumber: "+8801711000013",
	},
	{
		name: "Dr. Sadia Islam",
		email: "sadia.islam@phhealthcare.com",
		address: "House 38, Road 5, Khilgaon, Dhaka",
		specialization: "Urology",
		licenseNumber: "BMDC-20014",
		qualifications: "MBBS, MS (Urology)",
		experienceYears: 8,
		bio: "Urologist specializing in kidney stones, prostate diseases, urinary tract infections, and minimally invasive surgery.",
		consultationFee: 2000,
		contactNumber: "+8801711000014",
	},
	{
		name: "Dr. Mahbubur Rahman",
		email: "mahbubur.rahman@phhealthcare.com",
		address: "House 14, Road 2, Shantinagar, Dhaka",
		specialization: "Rheumatology",
		licenseNumber: "BMDC-20015",
		qualifications: "MBBS, MD (Rheumatology)",
		experienceYears: 9,
		bio: "Rheumatologist treating arthritis, lupus, gout, and other autoimmune and musculoskeletal disorders.",
		consultationFee: 1700,
		contactNumber: "+8801711000015",
	},
	{
		name: "Dr. Nasreen Akter",
		email: "nasreen.akter@phhealthcare.com",
		address: "House 6, Road 13, Dhanmondi, Dhaka",
		specialization: "Gynecology",
		licenseNumber: "BMDC-20016",
		qualifications: "MBBS, FCPS (Gynecology & Obstetrics)",
		experienceYears: 17,
		bio: "Gynecologist and obstetrician providing prenatal care, fertility treatment, and women's health services.",
		consultationFee: 2500,
		contactNumber: "+8801711000016",
	},
	{
		name: "Dr. Shahidul Haque",
		email: "shahidul.haque@phhealthcare.com",
		address: "House 29, Road 11, Gulshan, Dhaka",
		specialization: "General Surgery",
		licenseNumber: "BMDC-20017",
		qualifications: "MBBS, FCPS (Surgery)",
		experienceYears: 20,
		bio: "General surgeon with extensive experience in laparoscopic surgery, hernia repair, and abdominal procedures.",
		consultationFee: 2800,
		contactNumber: "+8801711000017",
	},
	{
		name: "Dr. Rubina Ferdous",
		email: "rubina.ferdous@phhealthcare.com",
		address: "House 20, Road 8, Badda, Dhaka",
		specialization: "Anesthesiology",
		licenseNumber: "BMDC-20018",
		qualifications: "MBBS, DA (Anesthesiology)",
		experienceYears: 11,
		bio: "Anesthesiologist providing perioperative care, pain management, and critical care support.",
		consultationFee: 1600,
		contactNumber: "+8801711000018",
	},
	{
		name: "Dr. Arif Mahmud",
		email: "arif.mahmud@phhealthcare.com",
		address: "House 8, Road 6, Rampura, Dhaka",
		specialization: "Radiology",
		licenseNumber: "BMDC-20019",
		qualifications: "MBBS, DMRD (Radiology)",
		experienceYears: 7,
		bio: "Radiologist experienced in diagnostic imaging including CT scan, MRI, ultrasound, and X-ray interpretation.",
		consultationFee: 1400,
		contactNumber: "+8801711000019",
	},
	{
		name: "Dr. Mehnaz Chowdhury",
		email: "mehnaz.chowdhury@phhealthcare.com",
		address: "House 17, Road 3, Malibagh, Dhaka",
		specialization: "Dentistry",
		licenseNumber: "BMDC-20020",
		qualifications: "BDS, FCPS (Oral & Maxillofacial Surgery)",
		experienceYears: 6,
		bio: "Dentist specializing in oral surgery, root canal treatment, dental implants, and cosmetic dentistry.",
		consultationFee: 1000,
		contactNumber: "+8801711000020",
	},
	{
		name: "Dr. Golam Mostafa",
		email: "golam.mostafa@phhealthcare.com",
		address: "House 25, Road 10, Tejgaon, Dhaka",
		specialization: "Plastic Surgery",
		licenseNumber: "BMDC-20021",
		qualifications: "MBBS, MS (Plastic Surgery)",
		experienceYears: 18,
		bio: "Plastic and reconstructive surgeon specializing in burn reconstruction, cleft lip repair, and cosmetic procedures.",
		consultationFee: 3000,
		contactNumber: "+8801711000021",
	},
	{
		name: "Dr. Sabrina Rahman",
		email: "sabrina.rahman@phhealthcare.com",
		address: "House 33, Road 7, Mohammadpur, Dhaka",
		specialization: "Hematology",
		licenseNumber: "BMDC-20022",
		qualifications: "MBBS, MD (Hematology)",
		experienceYears: 10,
		bio: "Hematologist treating anemia, blood disorders, thalassemia, and coagulation abnormalities.",
		consultationFee: 2100,
		contactNumber: "+8801711000022",
	},
	{
		name: "Dr. Zakir Hossain",
		email: "zakir.hossain@phhealthcare.com",
		address: "House 4, Road 9, Mirpur, Dhaka",
		specialization: "Infectious Disease",
		licenseNumber: "BMDC-20023",
		qualifications: "MBBS, MD (Infectious Disease)",
		experienceYears: 12,
		bio: "Infectious disease specialist managing viral infections, tuberculosis, dengue, and antibiotic stewardship.",
		consultationFee: 1900,
		contactNumber: "+8801711000023",
	},
	{
		name: "Dr. Taslima Begum",
		email: "taslima.begum@phhealthcare.com",
		address: "House 13, Road 4, Khilgaon, Dhaka",
		specialization: "Family Medicine",
		licenseNumber: "BMDC-20024",
		qualifications: "MBBS, FCPS (Family Medicine)",
		experienceYears: 9,
		bio: "Family medicine physician offering preventive care, chronic disease management, and primary healthcare for all ages.",
		consultationFee: 1000,
		contactNumber: "+8801711000024",
	},
];

export const seedDoctors = async () => {
	const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
	const hashedPassword = await bcrypt.hash(DOCTOR_SEED_PASSWORD, saltRounds);

	let created = 0;
	let skipped = 0;

	for (const doctor of doctors) {
		const isDoctorExist = await prisma.user.findUnique({
			where: {
				email: doctor.email,
			},
		});

		if (isDoctorExist) {
			skipped += 1;
			logger.info(`Other Doctor Already Exists, skipping: ${doctor.email}`);
			continue;
		}

		try {
			await prisma.user.create({
				data: {
					name: doctor.name,
					email: doctor.email,
					password: hashedPassword,
					role: Role.DOCTOR,
					emailVerified: true,
					needPasswordChange: false,
					doctor: {
						create: {
							name: doctor.name,
							email: doctor.email,
							address: doctor.address,
							specialization: doctor.specialization,
							licenseNumber: doctor.licenseNumber,
							qualifications: doctor.qualifications,
							experienceYears: doctor.experienceYears,
							bio: doctor.bio,
							consultationFee: doctor.consultationFee,
							contactNumber: doctor.contactNumber,
							verificationStatus: DoctorVerificationStatus.VERIFIED,
						},
					},
				},
			});

			created += 1;
			logger.info(`Other Doctor seeded: ${doctor.name} (${doctor.specialization})`);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				skipped += 1;
				logger.info(
					`Other Doctor Already Exists (unique constraint), skipping: ${doctor.email}`,
				);
				continue;
			}

			throw error;
		}
	}

	logger.info(
		`Other Doctor seeding completed. Created: ${created}, Skipped: ${skipped}, Total: ${doctors.length}`,
	);

	return { created, skipped, total: doctors.length };
};

const main = async () => {
	try {
		await prisma.$connect();
		logger.info("Connected to the database for doctor seeding.");

		await seedDoctors();
	} catch (error) {
		logger.error("Error seeding doctors:", error);
		process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
};

if (require.main === module) {
	main();
}
