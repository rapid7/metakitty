import { describe, expect, it } from "vitest";
import { getModuleDetails } from "../src/lib/stats/module-details";
import type { RawModuleMetadataEntry } from "../src/lib/stats/module-counts-client";

function entry(overrides: Partial<RawModuleMetadataEntry> = {}): RawModuleMetadataEntry {
  return {
    fullname: "exploit/windows/smb/ms17_010_eternalblue",
    type: "exploit",
    path: "/modules/exploits/windows/smb/ms17_010_eternalblue.rb",
    disclosure_date: "2017-03-14",
    references: ["CVE-2017-0144", "URL-https://example.com/advisory", "OSVDB-37667"],
    name: "MS17-010 EternalBlue",
    aliases: [],
    rank: 200,
    author: ["Equation Group"],
    description: "Paragraph one.\n\nParagraph two.",
    platform: "Windows",
    arch: "x64",
    targets: ["Windows 7"],
    mod_time: "2025-06-06 12:39:33 +0000",
    ref_name: "windows/smb/ms17_010_eternalblue",
    check: true,
    post_auth: false,
    default_credential: false,
    notes: { AKA: ["ETERNALBLUE"] },
    ...overrides,
  };
}

describe("getModuleDetails", () => {
  it("keys the resulting map by fullname", () => {
    const details = getModuleDetails([entry()]);
    expect([...details.keys()]).toEqual(["exploit/windows/smb/ms17_010_eternalblue"]);
  });

  it("passes through metadata fields and derives slugSegments", () => {
    const detail = getModuleDetails([entry()]).get("exploit/windows/smb/ms17_010_eternalblue")!;
    expect(detail).toMatchObject({
      name: "MS17-010 EternalBlue",
      type: "exploit",
      author: ["Equation Group"],
      platform: "Windows",
      arch: "x64",
      disclosureDate: "2017-03-14",
      targets: ["Windows 7"],
      check: true,
      postAuth: false,
      defaultCredential: false,
      slugSegments: ["exploit", "windows", "smb", "ms17_010_eternalblue"],
    });
  });

  it.each([
    [0, "Manual"],
    [100, "Low"],
    [200, "Average"],
    [300, "Normal"],
    [400, "Good"],
    [500, "Great"],
    [600, "Excellent"],
  ])("maps numeric rank %i to label %s", (rank, label) => {
    const detail = getModuleDetails([entry({ rank })]).get("exploit/windows/smb/ms17_010_eternalblue")!;
    expect(detail.rankLabel).toBe(label);
  });

  it("falls back to a generic label for an unrecognized rank", () => {
    const detail = getModuleDetails([entry({ rank: 999 })]).get("exploit/windows/smb/ms17_010_eternalblue")!;
    expect(detail.rankLabel).toBe("Rank 999");
  });

  it("parses references by prefix: CVE links to NVD, URL- strips its prefix, others have no link", () => {
    const detail = getModuleDetails([entry()]).get("exploit/windows/smb/ms17_010_eternalblue")!;
    expect(detail.references).toEqual([
      { label: "CVE-2017-0144", href: "https://nvd.nist.gov/vuln/detail/CVE-2017-0144" },
      { label: "https://example.com/advisory", href: "https://example.com/advisory" },
      { label: "OSVDB-37667", href: null },
    ]);
  });

  it("handles a module with no targets, no disclosure date, and empty notes", () => {
    const detail = getModuleDetails([entry({ targets: null, disclosure_date: null, notes: {}, references: [] })]).get(
      "exploit/windows/smb/ms17_010_eternalblue",
    )!;
    expect(detail.targets).toBeNull();
    expect(detail.disclosureDate).toBeNull();
    expect(detail.notes).toEqual({});
    expect(detail.references).toEqual([]);
  });
});
