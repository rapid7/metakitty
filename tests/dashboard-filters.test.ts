import { describe, expect, it } from "vitest";
import { readUrlFilterState, writeUrlFilterState, type UrlFilterState } from "../src/lib/dashboard-filters";

const defaults: UrlFilterState = {
  queueFilter: null,
  creationInterval: undefined,
  ageInterval: undefined,
  assigneeFilter: "all",
  testingFilter: "all",
  scopeFilter: "all",
  ciFilter: "all",
  reviewFilter: "all",
  labelFilter: "all",
  search: "",
  sortField: "createdAt",
  sortDirection: "desc",
  openDialog: null,
};

it("reads every default with an empty query string", () => {
  expect(readUrlFilterState("")).toEqual(defaults);
});

it("writes no params at all when every field is at its default", () => {
  expect(writeUrlFilterState(defaults).toString()).toBe("");
});

it("round-trips a full selection of filters, sort, and search through the URL", () => {
  const state: UrlFilterState = {
    queueFilter: "ci-failing",
    creationInterval: undefined,
    ageInterval: undefined,
    assigneeFilter: "user:alice",
    testingFilter: "docker",
    scopeFilter: "research",
    ciFilter: "failing",
    reviewFilter: "changes_requested",
    labelFilter: "bug",
    search: "widget rce",
    openDialog: null,
    sortField: "cvss",
    sortDirection: "asc",
  };
  const params = writeUrlFilterState(state);
  expect(readUrlFilterState(`?${params.toString()}`)).toEqual(state);
});

it("round-trips a creation-date histogram selection, including affiliation", () => {
  const state: UrlFilterState = {
    ...defaults,
    queueFilter: "created",
    creationInterval: { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z", label: "Jan 2026", affiliation: "rapid7" },
  };
  const params = writeUrlFilterState(state);
  expect(readUrlFilterState(`?${params.toString()}`)).toEqual(state);
});

it("falls back to defaults for unrecognized or malicious query values", () => {
  const state = readUrlFilterState("?filter=<script>&env=bogus&scope=bogus&ci=bogus&review=bogus&sort=bogus&dir=bogus");
  expect(state).toEqual(defaults);
});

it("ignores a creation interval unless the queue filter is 'created'", () => {
  const state = readUrlFilterState("?filter=rapid7&start=2026-01-01T00:00:00.000Z&end=2026-02-01T00:00:00.000Z");
  expect(state.queueFilter).toBe("rapid7");
  expect(state.creationInterval).toBeUndefined();
});

it("round-trips an age histogram selection, including an open-ended bucket", () => {
  const state: UrlFilterState = {
    ...defaults,
    queueFilter: "age",
    ageInterval: { minDays: 365, maxDays: null, label: "365+ days", affiliation: "community" },
  };
  const params = writeUrlFilterState(state);
  expect(readUrlFilterState(`?${params.toString()}`)).toEqual(state);
});

it("ignores an age interval unless the queue filter is 'age'", () => {
  const state = readUrlFilterState("?filter=rapid7&agemin=7&agemax=30");
  expect(state.queueFilter).toBe("rapid7");
  expect(state.ageInterval).toBeUndefined();
});

it("drops the sort param when it matches the default field, even if a direction is set", () => {
  const params = writeUrlFilterState({ ...defaults, sortField: "createdAt", sortDirection: "asc" });
  expect(params.get("sort")).toBeNull();
  expect(params.get("dir")).toBe("asc");
});

it("round-trips an open QueueOverview dialog", () => {
  const state: UrlFilterState = { ...defaults, openDialog: "assignment-histogram" };
  const params = writeUrlFilterState(state);
  expect(readUrlFilterState(`?${params.toString()}`)).toEqual(state);
});

it("ignores an unrecognized dialog id", () => {
  expect(readUrlFilterState("?dialog=bogus").openDialog).toBeNull();
});
