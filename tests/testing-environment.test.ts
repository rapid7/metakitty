import { expect, it } from "vitest";
import { classifyTestingEnvironment as classify } from "../src/lib/testing-environment";

it("defaults absent paths, generic modules, and non-module Dockerfiles to unknown or framework", () => {
  expect(classify(null).testingEnv).toBe("unknown");
  expect(classify(["modules/exploits/multi/http/example.rb", "Dockerfile"], "Run Metasploit in Docker.").testingEnv).toBe("unknown");
  expect(classify(["Dockerfile"]).testingEnv).toBe("framework");
  expect(classify(["tools/windows/setup.ps1"]).testingEnv).toBe("framework");
});

it("uses target module paths to infer platform", () => {
  expect(classify(["modules/exploits/windows/http/example.rb"]).testingEnv).toBe("windows");
  expect(classify(["modules/exploits/linux/http/example.rb"]).testingEnv).toBe("linux");
  expect(classify(["modules/exploits/osx/local/example.rb"]).testingEnv).toBe("macos");
  expect(classify(["modules/payloads/singles/android/example.rb"]).testingEnv).toBe("android");
  expect(classify(["modules/exploits/unix/example.rb"]).testingEnv).toBe("unix");
  expect(classify(["modules/exploits/freebsd/example.rb"]).testingEnv).toBe("bsd");
  expect(classify(["lib/msf/core/post/windows/ldap.rb"]).testingEnv).toBe("windows");
  expect(classify(["modules/auxiliary/example.rb"]).testingEnv).toBe("unknown");
});

it("requires affirmative target setup evidence for Docker or appliances", () => {
  expect(classify([], "Target environment: Docker").testingEnv).toBe("docker");
  const result = classify(["documentation/modules/example.md"], "Test target: Appliance");
  expect(result.testingEnv).toBe("appliance");
  expect(result.testingEnvReason).toContain("PR test instructions");
  expect(classify([], "Target setup: appliance\nTarget setup: Docker").testingEnv).toBe("multiple");
  for (const text of ["Dockerfile added", "Target setup: not Docker", "Target setup: Docker?", "Target setup: Docker unsupported"]) {
    expect(classify([], text).testingEnv).toBe("unknown");
  }
});

it("keeps target deployment separate from target OS", () => {
  expect(classify(["modules/exploits/linux/http/example.rb"], "Target setup: Docker").testingEnv).toBe("docker");
});

it("uses natural testing statements and distinguishes framework work from missing evidence", () => {
  expect(classify(["modules/auxiliary/example.rb"], "This module was tested against Windows Server 2019.").testingEnv).toBe("windows");
  expect(classify(["lib/msf/core/opt.rb", "spec/lib/msf/core/opt_spec.rb"]).testingEnv).toBe("framework");
  expect(classify(["modules/auxiliary/example.rb"]).testingEnv).toBe("unknown");
});

it("treats a docker run/compose command in the Setup and Reproduction section as target evidence", () => {
  const body = "## Description\nSome fix.\n\n## Setup and Reproduction\n1. Deploy a vulnerable instance:\ndocker run -d --name vulnapp -p 3000:3000 vulnapp/vulnapp\n2. Exploit it.\n\n## Verification\nDone.";
  expect(classify([], body).testingEnv).toBe("docker");
  expect(classify([], "## Setup and Reproduction\nRHOSTS <target> (Docker environment in data/exploits/CVE-2026-1/)").testingEnv).toBe("docker");
  // A bare "ran it in Docker" mention, or one referring to msfconsole/Metasploit itself, is the
  // attacker's own setup, not the target's.
  expect(classify([], "## Setup and Reproduction\nRun Metasploit in Docker.").testingEnv).toBe("unknown");
  expect(classify([], "## Setup and Reproduction\nStart msfconsole in Docker.").testingEnv).toBe("unknown");
  expect(classify([], "Deploy a vulnerable instance:\ndocker run -d --name vulnapp vulnapp/vulnapp").testingEnv).toBe("unknown");
});

it("recognizes appliance evidence without treating template guidance as evidence", () => {
  expect(classify(["modules/exploits/unix/smtp/cisco.rb"], "Repair the appliance after testing").testingEnv).toBe("appliance");
  expect(classify(["modules/auxiliary/scanner/example.rb"], "If your module targets specialized hardware (routers, IoT, PLCs), provide a video.").testingEnv).toBe("unknown");
});
