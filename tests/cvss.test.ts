import { expect, it } from "vitest";
import { cvssBaseFromVector } from "../src/lib/vuln/cvss";

it("computes the known Log4Shell (CVE-2021-44228) base score", () => {
  // Verified against the live NVD record: baseScore 10.0.
  expect(cvssBaseFromVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H")).toBe(10);
});

it("computes a low-severity local vector correctly", () => {
  expect(cvssBaseFromVector("CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N")).toBe(1.8);
});

it("returns 0 when impact is zero (no confidentiality/integrity/availability loss)", () => {
  expect(cvssBaseFromVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N")).toBe(0);
});

it("accepts CVSS v3.0 vectors using the same base formula", () => {
  expect(cvssBaseFromVector("CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H")).toBe(10);
});

it("returns null for non-v3 vectors or malformed/incomplete metrics", () => {
  expect(cvssBaseFromVector("AV:N/AC:L/Au:N/C:C/I:C/A:C")).toBeNull(); // CVSS v2, unsupported
  expect(cvssBaseFromVector("CVSS:3.1/AV:N/AC:L")).toBeNull(); // missing required metrics
  expect(cvssBaseFromVector("not a vector")).toBeNull();
});
