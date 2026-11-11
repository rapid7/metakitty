import { describe, expect, it } from "vitest";
import { getModuleCounts } from "../src/lib/stats/module-counts";
import type { RawModuleMetadataEntry } from "../src/lib/stats/module-counts-client";

function entry(fullname: string, type: string, path?: string): RawModuleMetadataEntry {
  return { fullname, type, path: path ?? `/modules/${fullname}.rb` };
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
        children: [
          {
            name: "admin",
            total: 2,
            modulePath: null,
            children: [
              { name: "2wire", total: 1, modulePath: null, children: [{ name: "xslt_password_reset", total: 1, modulePath: "modules/auxiliary/admin/2wire/xslt_password_reset.rb", children: [] }] },
              { name: "foo", total: 1, modulePath: "modules/auxiliary/admin/foo.rb", children: [] },
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
        children: [{ name: "admin", total: 2, modulePath: null, children: [{ name: "foo", total: 2, modulePath: "modules/auxiliary/admin/foo.rb", children: [] }] }],
      },
    ]);
  });
});
