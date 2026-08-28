import z from "zod";

const createScheduleZodSchema = z
	.object({
		startDateTime: z.coerce.date({
			error: (issue) =>
				issue.input === undefined
					? "Start date and time is required"
					: "Invalid start date and time format",
		}),

		endDateTime: z.coerce.date({
			error: (issue) =>
				issue.input === undefined
					? "End date and time is required"
					: "Invalid end date and time format",
		}),

		meetingLink: z.url("Invalid Meeting Link").trim(),
	})
	.refine((data) => data.endDateTime > data.startDateTime, {
		message: "End date and time must be after start date and time",
		path: ["endDateTime"],
	});

const updateScheduleZodSchema = z
	.object({
		startDateTime: z.coerce
			.date({
				error: "Invalid start date and time format",
			})
			.optional(),

		endDateTime: z.coerce
			.date({
				error: "Invalid end date and time format",
			})
			.optional(),

		meetingLink: z.url("Invalid Meeting Link").trim().optional(),
	})
	.refine(
		(data) => {
			// If both dates are provided, end must be after start
			if (data.startDateTime && data.endDateTime) {
				return data.endDateTime > data.startDateTime;
			}

			return true;
		},
		{
			message: "End date and time must be after start date and time",
			path: ["endDateTime"],
		},
	);

export const ScheduleValidation = {
	createScheduleZodSchema,
	updateScheduleZodSchema,
};
