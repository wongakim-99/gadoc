import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

// 환경 변수의 존재가 아니라 실제 빌드 산출물과 OS 검증 기록을 확인한다.
export function verifyPlatformEvidence(proof, platform, version, assets) {
  if (
    proof?.schemaVersion !== 1 ||
    proof.version !== version ||
    proof.platform !== platform
  )
    throw new Error(`Invalid ${platform} verification version`);
  if (typeof proof.codeSigned !== "boolean" || !Array.isArray(proof.assets))
    throw new Error(`Missing ${platform} signature evidence`);
  for (const asset of assets) {
    if (
      !proof.assets.some(
        (entry) => entry.name === asset.name && entry.sha256 === asset.sha256,
      )
    )
      throw new Error(`Verification hash mismatch: ${asset.name}`);
  }
  if (platform === "mac") {
    if (
      typeof proof.notarized !== "boolean" ||
      (proof.notarized && !proof.codeSigned)
    )
      throw new Error("Invalid notarization evidence");
    if (proof.codeSigned && !/^[A-Z0-9]{10}$/.test(proof.teamId ?? ""))
      throw new Error("Missing signing team");
    if (proof.notarized) {
      const checks = [
        "codesign-app",
        "codesign-dmg",
        "codesign-zip",
        "gatekeeper-app",
        "gatekeeper-dmg",
        "gatekeeper-zip",
        "stapler-app",
        "stapler-dmg",
        "stapler-zip",
      ];
      if (
        !checks.every((check) => proof.checks?.includes(check)) ||
        !/^[a-f0-9-]{36}$/i.test(proof.notarySubmissionId ?? "")
      )
        throw new Error("Incomplete notarization checks");
    }
  } else if (
    proof.codeSigned &&
    (!proof.checks?.includes("authenticode-valid") ||
      !/^[a-f0-9]{40,64}$/i.test(proof.certificateThumbprint ?? ""))
  ) {
    throw new Error("Missing Authenticode evidence");
  }
  return proof;
}
