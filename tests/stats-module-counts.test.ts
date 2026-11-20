import { describe, expect, it } from "vitest";
import {
  collectFolderPaths,
  findTreeNode,
  getDistinctModuleCveRefs,
  getModuleCounts,
  pivotCweYearBreakdown,
  tallyModuleCweCounts,
  type ModuleCweYearBreakdown,
} from "../src/lib/stats/module-counts";
import type { RawModuleMetadataEntry } from "../src/lib/stats/module-counts-client";

function entry(fullname: string, type: string, path?: string, cve?: { disclosureDate: string; cveId: string }): RawModuleMetadataEntry {
  return {
    fullname,
    type,
    path: path ?? `/modules/${fullname}.rb`,
    disclosure_date: cve?.disclosureDate ?? null,
    references: cve ? [cve.cveId] : [],
    name: fullname,
    aliases: [],
    rank: 300,
    author: [],
    description: "",
    platform: "",
    arch: "",
    targets: null,
    mod_time: "",
    ref_name: fullname,
    check: false,
    post_auth: false,
    default_credential: false,
    notes: {},
  };
}

describe("getModuleCounts", () => {
  it("counts every metadata entry", () => {
    const counts = getModuleCounts([entry("auxiliary/admin/foo", "auxiliary"), entry("exploit/linux/http/bar", "exploit")]);
    expect(counts.totalCount).toBe(2);
  });

  it("groups counts by type, with label/description from MODULE_TYPES", () => {
    const counts = getModuleCounts([
      entry("auxiliary/admin/foo", "auxiliary"),
      entry("auxiliary/scanner/http/bar", "auxiliary"),
      entry("exploit/linux/http/baz", "exploit"),
    ]);
    expect(counts.countsByType).toEqual([
      { type: "auxiliary", label: "Auxiliary", description: expect.stringContaining("Does not exploit"), count: 2 },
      { type: "exploit", label: "Exploit", description: expect.stringContaining("Leverages a vulnerability"), count: 1 },
    ]);
  });

  it("builds a nested tree by fullname segment, with leaf nodes carrying the module's file path (leading slash stripped)", () => {
    const counts = getModuleCounts([
      entry("auxiliary/admin/2wire/xslt_password_reset", "auxiliary", "/modules/auxiliary/admin/2wire/xslt_password_reset.rb"),
      entry("auxiliary/admin/foo", "auxiliary", "/modules/auxiliary/admin/foo.rb"),
    ]);

    expect(counts.tree).toEqual([
      {
        name: "auxiliary",
        total: 2,
        modulePath: null,
        fullname: null,
        children: [
          {
            name: "admin",
            total: 2,
            modulePath: null,
            fullname: null,
            children: [
              {
                name: "2wire",
                total: 1,
                modulePath: null,
                fullname: null,
                children: [
                  {
                    name: "xslt_password_reset",
                    total: 1,
                    modulePath: "modules/auxiliary/admin/2wire/xslt_password_reset.rb",
                    fullname: "auxiliary/admin/2wire/xslt_password_reset",
                    children: [],
                  },
                ],
              },
              { name: "foo", total: 1, modulePath: "modules/auxiliary/admin/foo.rb", fullname: "auxiliary/admin/foo", children: [] },
            ],
          },
        ],
      },
    ]);
  });

  it("sorts sibling nodes alphabetically at every depth", () => {
    const counts = getModuleCounts([entry("post/zeta", "post"), entry("auxiliary/alpha", "auxiliary"), entry("exploit/mid", "exploit")]);
    expect(counts.tree.map((node) => node.name)).toEqual(["auxiliary", "exploit", "post"]);
  });

  it("counts multiple metadata entries (e.g. a payload's stager+stage combinations) that share the same underlying file path", () => {
    const counts = getModuleCounts([
      entry("payload/windows/meterpreter/reverse_tcp", "payload", "/modules/payloads/stagers/windows/reverse_tcp.rb"),
      entry("payload/windows/meterpreter/reverse_http", "payload", "/modules/payloads/stagers/windows/reverse_tcp.rb"),
    ]);
    expect(counts.totalCount).toBe(2);
    expect(counts.countsByType).toEqual([{ type: "payload", label: "Payload", description: expect.any(String), count: 2 }]);
  });

  it("resolves a module that shares its fullname with an ancestor directory of further modules, without recursing forever", () => {
    const counts = getModuleCounts([entry("auxiliary/admin/foo", "auxiliary"), entry("auxiliary/admin/foo/bar", "auxiliary")]);
    expect(counts.totalCount).toBe(2);
    expect(counts.tree).toEqual([
      {
        name: "auxiliary",
        total: 2,
        modulePath: null,
        fullname: null,
        children: [
          {
            name: "admin",
            total: 2,
            modulePath: null,
            fullname: null,
            children: [{ name: "foo", total: 2, modulePath: "modules/auxiliary/admin/foo.rb", fullname: "auxiliary/admin/foo", children: [] }],
          },
        ],
      },
    ]);
  });

  it("counts modules with a CVE reference by disclosure year, ignoring modules with no CVE or no disclosure date", () => {
    const counts = getModuleCounts([
      entry("exploit/windows/smb/ms17_010_eternalblue", "exploit", undefined, { disclosureDate: "2017-03-14", cveId: "CVE-2017-0144" }),
      entry("exploit/windows/smb/ms08_067_netapi", "exploit", undefined, { disclosureDate: "2008-10-23", cveId: "CVE-2008-4250" }),
      entry("auxiliary/admin/2wire/xslt_password_reset", "auxiliary", undefined, { disclosureDate: "2007-08-15", cveId: "CVE-2007-4387" }),
      entry("auxiliary/scanner/http/http_version", "auxiliary"),
    ]);

    expect(counts.cveCountsByYear).toEqual([
      { year: 2007, count: 1 },
      { year: 2008, count: 1 },
      { year: 2017, count: 1 },
    ]);
  });

  it("deduplicates CVE counts by file path (e.g. a payload's stager+stage combinations)", () => {
    const counts = getModuleCounts([
      entry("payload/windows/meterpreter/reverse_tcp", "payload", "/modules/shared.rb", { disclosureDate: "2017-03-14", cveId: "CVE-2017-0144" }),
      entry("payload/windows/meterpreter/reverse_http", "payload", "/modules/shared.rb", { disclosureDate: "2017-03-14", cveId: "CVE-2017-0144" }),
    ]);
    expect(counts.cveCountsByYear).toEqual([{ year: 2017, count: 1 }]);
  });
});

describe("getModuleCounts' cveDetailsByYear", () => {
  function withDateAndRefs(fullname: string, path: string, disclosureDate: string | null, references: string[]): RawModuleMetadataEntry {
    return { ...entry(fullname, "exploit", path), disclosure_date: disclosureDate, references };
  }

  it("names each module and its CVE ids under its disclosure year, newest year first", () => {
    const counts = getModuleCounts([
      withDateAndRefs("exploit/windows/smb/ms17_010_eternalblue", "/modules/a.rb", "2017-03-14", ["CVE-2017-0144"]),
      withDateAndRefs("auxiliary/admin/2wire/xslt_password_reset", "/modules/b.rb", "2007-08-15", ["CVE-2007-4387"]),
    ]);
    expect(counts.cveDetailsByYear).toEqual([
      { year: 2017, modules: [{ fullname: "exploit/windows/smb/ms17_010_eternalblue", path: "modules/a.rb", cveIds: ["CVE-2017-0144"] }] },
      { year: 2007, modules: [{ fullname: "auxiliary/admin/2wire/xslt_password_reset", path: "modules/b.rb", cveIds: ["CVE-2007-4387"] }] },
    ]);
  });

  it("lists every CVE id a module references, not just one", () => {
    const counts = getModuleCounts([
      withDateAndRefs("exploit/windows/smb/ms17_010_eternalblue", "/modules/a.rb", "2017-03-14", [
        "MSB-MS17-010",
        "CVE-2017-0143",
        "CVE-2017-0144",
        "URL-https://example.com",
      ]),
    ]);
    expect(counts.cveDetailsByYear).toEqual([
      { year: 2017, modules: [{ fullname: "exploit/windows/smb/ms17_010_eternalblue", path: "modules/a.rb", cveIds: ["CVE-2017-0143", "CVE-2017-0144"] }] },
    ]);
  });

  it("sorts modules within a year alphabetically by fullname", () => {
    const counts = getModuleCounts([
      withDateAndRefs("exploit/b", "/modules/b.rb", "2020-01-01", ["CVE-2020-0002"]),
      withDateAndRefs("exploit/a", "/modules/a.rb", "2020-01-01", ["CVE-2020-0001"]),
    ]);
    expect(counts.cveDetailsByYear).toEqual([
      {
        year: 2020,
        modules: [
          { fullname: "exploit/a", path: "modules/a.rb", cveIds: ["CVE-2020-0001"] },
          { fullname: "exploit/b", path: "modules/b.rb", cveIds: ["CVE-2020-0002"] },
        ],
      },
    ]);
  });

  it("ignores modules with no CVE reference or no disclosure date", () => {
    const counts = getModuleCounts([
      withDateAndRefs("auxiliary/a", "/modules/a.rb", null, ["CVE-2020-0001"]),
      withDateAndRefs("auxiliary/b", "/modules/b.rb", "2020-01-01", []),
    ]);
    expect(counts.cveDetailsByYear).toEqual([]);
  });

  it("deduplicates by file path (e.g. a payload's stager+stage combinations)", () => {
    const counts = getModuleCounts([
      withDateAndRefs("payload/a", "/modules/shared.rb", "2020-01-01", ["CVE-2020-0001"]),
      withDateAndRefs("payload/b", "/modules/shared.rb", "2020-01-01", ["CVE-2020-0001"]),
    ]);
    expect(counts.cveDetailsByYear).toEqual([{ year: 2020, modules: [{ fullname: "payload/a", path: "modules/shared.rb", cveIds: ["CVE-2020-0001"] }] }]);
  });
});

describe("findTreeNode", () => {
  const counts = getModuleCounts([
    entry("auxiliary/admin/2wire/xslt_password_reset", "auxiliary", "/modules/auxiliary/admin/2wire/xslt_password_reset.rb"),
    entry("auxiliary/admin/foo", "auxiliary", "/modules/auxiliary/admin/foo.rb"),
  ]);

  it("resolves a folder path to its node", () => {
    const node = findTreeNode(counts.tree, ["auxiliary", "admin", "2wire"]);
    expect(node).toMatchObject({ name: "2wire", modulePath: null, fullname: null });
  });

  it("resolves a leaf (module) path to its node", () => {
    const node = findTreeNode(counts.tree, ["auxiliary", "admin", "2wire", "xslt_password_reset"]);
    expect(node).toMatchObject({ name: "xslt_password_reset", fullname: "auxiliary/admin/2wire/xslt_password_reset" });
  });

  it("returns null for a path that doesn't exist", () => {
    expect(findTreeNode(counts.tree, ["auxiliary", "nope"])).toBeNull();
  });

  it("returns null for an empty tree or empty path mismatch", () => {
    expect(findTreeNode([], ["auxiliary"])).toBeNull();
  });
});

describe("collectFolderPaths", () => {
  it("collects every folder (non-leaf) path, excluding leaf modules", () => {
    const counts = getModuleCounts([
      entry("auxiliary/admin/2wire/xslt_password_reset", "auxiliary", "/modules/auxiliary/admin/2wire/xslt_password_reset.rb"),
      entry("auxiliary/scanner/http/bar", "auxiliary", "/modules/auxiliary/scanner/http/bar.rb"),
    ]);
    expect(collectFolderPaths(counts.tree)).toEqual([
      ["auxiliary"],
      ["auxiliary", "admin"],
      ["auxiliary", "admin", "2wire"],
      ["auxiliary", "scanner"],
      ["auxiliary", "scanner", "http"],
    ]);
  });

  it("excludes a leaf that shares its path with what would otherwise be an ancestor folder", () => {
    const counts = getModuleCounts([entry("auxiliary/admin/foo", "auxiliary"), entry("auxiliary/admin/foo/bar", "auxiliary")]);
    expect(collectFolderPaths(counts.tree)).toEqual([["auxiliary"], ["auxiliary", "admin"]]);
  });
});

describe("getModuleCounts' cweCounts (self-reported CWE references)", () => {
  function withRefs(fullname: string, type: string, path: string, references: string[]): RawModuleMetadataEntry {
    return { ...entry(fullname, type, path), references };
  }

  it("counts modules with a self-reported CWE- reference, ignoring other reference types", () => {
    const counts = getModuleCounts([
      withRefs("auxiliary/admin/2wire/xslt_password_reset", "auxiliary", "/modules/a.rb", ["CVE-2007-4387", "CWE-352"]),
      withRefs("exploit/linux/http/foo", "exploit", "/modules/b.rb", ["OSVDB-1"]),
    ]);
    expect(counts.cweCounts).toEqual([{ cwe: "CWE-352", count: 1 }]);
  });

  it("sorts by count descending, then by CWE id", () => {
    const counts = getModuleCounts([
      withRefs("a", "auxiliary", "/modules/a.rb", ["CWE-89"]),
      withRefs("b", "auxiliary", "/modules/b.rb", ["CWE-89"]),
      withRefs("c", "auxiliary", "/modules/c.rb", ["CWE-22"]),
    ]);
    expect(counts.cweCounts).toEqual([
      { cwe: "CWE-89", count: 2 },
      { cwe: "CWE-22", count: 1 },
    ]);
  });

  it("deduplicates by file path (e.g. a payload's stager+stage combinations)", () => {
    const counts = getModuleCounts([
      withRefs("a", "payload", "/modules/shared.rb", ["CWE-89"]),
      withRefs("b", "payload", "/modules/shared.rb", ["CWE-89"]),
    ]);
    expect(counts.cweCounts).toEqual([{ cwe: "CWE-89", count: 1 }]);
  });

  it("counts a module once per distinct CWE even if it repeats the same one", () => {
    const counts = getModuleCounts([withRefs("a", "auxiliary", "/modules/a.rb", ["CWE-89", "CWE-89"])]);
    expect(counts.cweCounts).toEqual([{ cwe: "CWE-89", count: 1 }]);
  });
});

describe("getDistinctModuleCveRefs", () => {
  it("collects each distinct module's CVE references, excluding non-CVE references and modules with none", () => {
    const refs = getDistinctModuleCveRefs([
      entry("exploit/a", "exploit", "/modules/a.rb", { disclosureDate: "2020-01-01", cveId: "CVE-2020-0001" }),
      entry("auxiliary/b", "auxiliary", "/modules/b.rb"),
    ]);
    expect(refs).toEqual([{ path: "/modules/a.rb", cveIds: ["CVE-2020-0001"] }]);
  });

  it("deduplicates by file path", () => {
    const refs = getDistinctModuleCveRefs([
      entry("payload/a", "payload", "/modules/shared.rb", { disclosureDate: "2020-01-01", cveId: "CVE-2020-0001" }),
      entry("payload/b", "payload", "/modules/shared.rb", { disclosureDate: "2020-01-01", cveId: "CVE-2020-0001" }),
    ]);
    expect(refs).toEqual([{ path: "/modules/shared.rb", cveIds: ["CVE-2020-0001"] }]);
  });
});

describe("tallyModuleCweCounts", () => {
  it("counts a module once per distinct CWE among its resolved CVEs, not once per CVE", () => {
    expect(tallyModuleCweCounts([["CWE-89", "CWE-89"]])).toEqual([{ cwe: "CWE-89", count: 1 }]);
  });

  it("tallies across modules and sorts by count descending then CWE id", () => {
    expect(tallyModuleCweCounts([["CWE-89"], ["CWE-89"], ["CWE-22"], []])).toEqual([
      { cwe: "CWE-89", count: 2 },
      { cwe: "CWE-22", count: 1 },
    ]);
  });
});

describe("pivotCweYearBreakdown", () => {
  it("sorts rows by year ascending regardless of input order", () => {
    const breakdowns: ModuleCweYearBreakdown[] = [
      { year: 2020, counts: [{ cwe: "CWE-89", count: 1 }] },
      { year: 2010, counts: [{ cwe: "CWE-89", count: 1 }] },
    ];
    const { rows } = pivotCweYearBreakdown(breakdowns, 5);
    expect(rows.map((r) => r.year)).toEqual([2010, 2020]);
  });

  it("keeps the top N CWEs by total count across all years as their own keys", () => {
    const breakdowns: ModuleCweYearBreakdown[] = [
      {
        year: 2020,
        counts: [
          { cwe: "CWE-89", count: 5 },
          { cwe: "CWE-22", count: 1 },
        ],
      },
    ];
    const { cweKeys } = pivotCweYearBreakdown(breakdowns, 1);
    expect(cweKeys).toEqual(["CWE-89"]);
  });

  it("collapses anything outside the top N into an 'Other' total per year", () => {
    const breakdowns: ModuleCweYearBreakdown[] = [
      {
        year: 2020,
        counts: [
          { cwe: "CWE-89", count: 5 },
          { cwe: "CWE-22", count: 2 },
          { cwe: "CWE-78", count: 1 },
        ],
      },
    ];
    const { rows, cweKeys } = pivotCweYearBreakdown(breakdowns, 1);
    expect(cweKeys).toEqual(["CWE-89"]);
    expect(rows).toEqual([{ year: 2020, "CWE-89": 5, Other: 3 }]);
  });

  it("gives every year every key, defaulting to 0, so the stack is consistent across years", () => {
    const breakdowns: ModuleCweYearBreakdown[] = [
      { year: 2010, counts: [{ cwe: "CWE-89", count: 2 }] },
      { year: 2020, counts: [{ cwe: "CWE-22", count: 3 }] },
    ];
    const { rows } = pivotCweYearBreakdown(breakdowns, 5);
    expect(rows).toEqual([
      { year: 2010, "CWE-89": 2, "CWE-22": 0, Other: 0 },
      { year: 2020, "CWE-89": 0, "CWE-22": 3, Other: 0 },
    ]);
  });
});
