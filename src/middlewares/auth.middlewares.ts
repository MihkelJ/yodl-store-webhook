import { Middleware } from "express-zod-api";
import createHttpError from "http-errors";
import { isHex, verifyMessage } from "viem";

/**
 * Authentication middleware that verifies requests are signed by Yodl
 *
 * @description
 * This middleware validates that incoming requests are authentic by verifying
 * a signature provided in the x-yodl-signature header against the request body.
 * The signature must be created by the Yodl address specified in YODL_ADDRESS env variable.
 *
 * @throws {Error} "Invalid signature" - If the signature header is missing, malformed, or invalid
 * @throws {Error} "Signature verification failed" - If the signature verification process fails
 *
 * @returns {Promise<{}>} Empty object if verification succeeds
 */
const authMiddleware = new Middleware({
  handler: async ({ request }) => {
    const signature = request.headers["x-yodl-signature"];

    if (!signature || !isHex(signature)) {
      console.error("Invalid signature", signature);
      throw createHttpError(400, "Invalid signature");
    }

    // Ensure the message is properly stringified and formatted
    const message =
      typeof request.body === "string"
        ? request.body
        : JSON.stringify(request.body);

    try {
      const isValid = await verifyMessage({
        message,
        signature: signature as `0x${string}`,
        address: process.env.YODL_ADDRESS as `0x${string}`,
      });

      if (!isValid) {
        console.error("Invalid signature", signature);
        throw createHttpError(400, "Invalid signature");
      }

      return {};
    } catch (error) {
      console.error("Signature verification failed", error);
      throw createHttpError(500, "Signature verification failed");
    }
  },
  security: {
    and: [{ type: "header", name: "x-yodl-signature" }],
  },
});

export default authMiddleware;
