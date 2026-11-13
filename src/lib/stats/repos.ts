export const STATS_OWNER = "rapid7";

/** The flagship repo — by far the largest contributor to the historical dataset. If a fetch comes back with zero data for this repo (e.g. after exhausting retries on a sustained GitHub outage), the dataset is unreliable and should not be cached/trusted, unlike a single obscure repo quietly failing. */
export const PRIMARY_REPO = "metasploit-framework";

/**
 * Ported from metakitty's `generate_pages` repo list. Some of these may since have been
 * renamed/archived/deleted — every fetch across this list must tolerate a 404 for an individual
 * repo (skip + warn) rather than failing the whole build.
 */
export const STATS_REPOS: string[] = [
  "metasploit-framework",
  "metasploit-payloads",
  "meterpreter",
  "metasploit-javapayload",
  "metasploit-omnibus",
  "metasploit_data_models",
  "metasploit-credential",
  "metasploit-model",
  "metasploit-aggregator",
  "metasploit-baseline-builder",
  "network_interface",
  "rex-encoder",
  "rex-rop_builder",
  "rex-mime",
  "rex-nop",
  "rex-text",
  "rex-powershell",
  "rex-sslscan",
  "rex-socket",
  "rex-core",
  "rex-bin_tools",
  "rex-ole",
  "rex-arch",
  "rex-struct2",
  "rex-registry",
  "rex-java",
  "rex-zip",
  "rex-random_identifier",
  "rex",
  "mettle",
  "metasploitable3",
  "msfrpc-client",
  "fastlib",
  "ruby_smb",
];
