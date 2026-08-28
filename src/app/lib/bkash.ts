import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../utils/AppError";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
	try {
		const IdTokenKey = "bKash:idToken";
		const RefreshTokenKey = "bKash:refreshToken";

		let bkashIdToken = await redisClient.get(IdTokenKey);
		const bkashIdTokenTTL = await redisClient.ttl(IdTokenKey);

		const bkashRefreshToken = await redisClient.get(RefreshTokenKey);
		const bkashRefreshTokenTTL = await redisClient.ttl(RefreshTokenKey);

		// console.log({
		//     bkashIdToken,
		//     bkashIdTokenTTL,
		//     bkashRefreshToken,
		//     bkashRefreshTokenTTL
		// });

		// bKash id token remaining time is less than equal 10 minutes or bKash id token is expired
		// bKash refresh token must exist
		// bKash refresh token remaining time is more than 10 minutes
		if (
			(bkashIdTokenTTL <= 600 || !bkashIdToken) &&
			bkashRefreshToken &&
			bkashRefreshTokenTTL > 600
		) {
			const refreshTokenResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/token/refresh`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						username: config.bkash_username,
						password: config.bkash_password,
					},
					body: JSON.stringify({
						app_key: config.bkash_app_key,
						app_secret: config.bkash_app_secret,
						refresh_token: bkashRefreshToken,
					}),
				},
			);

			if (!refreshTokenResponse.ok) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"bKash access token grant failed",
				);
			}

			const bkashRefreshTokenResult = await refreshTokenResponse.json();

			bkashIdToken = bkashRefreshTokenResult.id_token as string;

			await redisClient.set(IdTokenKey, bkashIdToken, {
				expiration: {
					type: "EX",
					value: 60 * 60,
				},
			});

			return bkashIdToken;
		}

		if (bkashIdTokenTTL > 600) {
			return bkashIdToken;
		}

		const response = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/token/grant`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					username: config.bkash_username,
					password: config.bkash_password,
				},
				body: JSON.stringify({
					app_key: config.bkash_app_key,
					app_secret: config.bkash_app_secret,
				}),
			},
		);

		if (!response.ok) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"bKash access token grant failed",
			);
		}

		const result = await response.json();

		// bKash id token set
		await redisClient.set(IdTokenKey, result.id_token, {
			expiration: {
				type: "EX",
				value: 60 * 60, // 1 hour
			},
		});

		// bKash refresh token set
		await redisClient.set(RefreshTokenKey, result.refresh_token, {
			expiration: {
				type: "EX",
				value: 60 * 60 * 24 * 28, // 28 days
			},
		});

		bkashIdToken = result.id_token;

		return bkashIdToken;
	} catch (error: unknown) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			error instanceof Error ? error.message : "bKash id token failed",
		);
	}
};
