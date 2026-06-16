/**
 * Wallet signature verification middleware.
 *
 * Accepts an EIP-4361 (Sign-In with Ethereum) message in the
 * `x-aevum-siwe` header along with the signature in `x-aevum-signature`.
 * On success, attaches the verified `AuthContext` to `req.auth`.
 */
import type { Request, Response, NextFunction } from "express";
import { SiweMessage } from "siwe";
import { config } from "../config.js";
import { HttpError } from "./errorHandler.js";
import type { Address, AuthContext } from "../types/index.js";

function getHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}

export interface AuthOptions {
  optional?: boolean;
}

export function requireWallet(_options: AuthOptions = {}): (req: Request, _res: Response, next: NextFunction) => void {
  return async (req, _res, next) => {
    try {
      const rawMessage = getHeader(req, "x-aevum-siwe");
      const signature = getHeader(req, "x-aevum-signature");
      if (!rawMessage || !signature) {
        throw new HttpError(401, "auth_required", "Missing SIWE message or signature");
      }
      // Accept either base64 (preferred — SIWE messages contain newlines
      // which are invalid in header values) or raw ASCII.
      let message: string;
      try {
        message = Buffer.from(rawMessage, "base64").toString("utf-8");
        if (!message.includes("localhost") && !message.includes("wants you to sign")) {
          message = rawMessage;
        }
      } catch {
        message = rawMessage;
      }
      const siwe = new SiweMessage(message);
      const result = await new SiweMessage(message).verify({ signature });
      if (!result.success) {
        throw new HttpError(401, "auth_invalid", "Signature verification failed");
      }
      if (siwe.domain !== config.SIWE_DOMAIN && siwe.domain !== "localhost") {
        throw new HttpError(401, "auth_domain", `Invalid SIWE domain: ${siwe.domain}`);
      }
      const ctx: AuthContext = {
        address: siwe.address as Address,
        issuedAt: siwe.issuedAt ?? new Date().toISOString(),
        ...(siwe.expirationTime ? { expiresAt: siwe.expirationTime } : {}),
        nonce: siwe.nonce,
      };
      req.auth = ctx;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Generate a SIWE challenge string for the client to sign.
 */
export function buildSiweChallenge(address: string, nonce: string): string {
  const msg = new SiweMessage({
    domain: config.SIWE_DOMAIN,
    address,
    statement: "Sign in to Aevum — decentralized AI agent memory infrastructure on 0G.",
    uri: config.AUTH_URI,
    version: "1",
    chainId: 16602,
    nonce,
    issuedAt: new Date().toISOString(),
  });
  return msg.prepareMessage();
}
