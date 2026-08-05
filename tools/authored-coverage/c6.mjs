// Coverage bank — final gap closure.
//
// These nineteen terms survived the first coverage pass for a reason worth
// recording: the bank already TAUGHT them, but always as a distractor or as a
// definition in the answer text, never as the credited term itself. The audit
// is deliberately strict about that — being able to pick "the expected loss
// from one event" is not the same as producing the words "single loss
// expectancy", and it is the words the exam credits.

const q = (objective, stem, options, answer, explanation) =>
  ({ objective, stem, options, answer, explanation });

export default [

/* 3.4 */
q('3.4', 'Several database servers are configured to act as a single logical system with coordinated state, so that one can take over from another transparently. Which technique is this?',
  ['Load balancing', 'Clustering', 'Geographic dispersion', 'Replication'], 1,
  'Clustering makes several nodes behave as ONE system with shared awareness. Load balancing distributes requests across independent servers that need not know about each other.'),

/* 4.1 */
q('4.1', 'A build pipeline inspects application source code for insecure patterns before the software is ever deployed. Which 4.1 application security control is this?',
  ['Input validation', 'Static code analysis', 'Code signing', 'Secure cookies'], 1,
  'Static code analysis reads code AT REST, before deployment. Input validation acts at runtime on data — one examines the program, the other examines what the program receives.'),
q('4.1', 'After hardening a fleet of servers, the team continuously observes them for configuration drift and unexpected activity. Which 4.1 technique does the objectives document name?',
  ['Sandboxing', 'Monitoring', 'Secure baselines', 'Configuration enforcement'], 1,
  'Monitoring appears in 4.1 as a technique applied to computing resources, and again in 2.5 and 4.4. Here it is the ongoing observation that proves the baseline is holding.'),

/* 4.2 */
q('4.2', 'Every asset record must name the business role accountable for the asset throughout its life. Which element of assignment/accounting is this?',
  ['Classification', 'Ownership', 'Inventory', 'Enumeration'], 1,
  'Ownership names the accountable party. Classification records how sensitive the asset is — the objectives list both as the two halves of assignment/accounting.'),
q('4.2', 'Each asset is labelled according to the sensitivity of the data it holds, so the correct handling controls can be applied. Which element of assignment/accounting is this?',
  ['Ownership', 'Classification', 'Data retention', 'Enumeration'], 1,
  'Classification drives the handling requirements. Ownership names who is accountable — an asset needs both, and the objectives pair them for that reason.'),

/* 4.3 */
q('4.3', 'An organisation publishes a security.txt file and a policy setting out how outside researchers may report vulnerabilities without legal risk. Which identification method is this?',
  ['Bug bounty program', 'Responsible disclosure program', 'System/process audit', 'Penetration testing'], 1,
  'A responsible disclosure programme provides the safe reporting channel. A bug bounty sits beneath it and adds payment — the stem mentions no reward, only safety.'),
q('4.3', 'A published vulnerability needs a unique public identifier so that every vendor and scanner refers to the same flaw. Which standard provides this?',
  ['Common Vulnerability Scoring System (CVSS)', 'Common Vulnerability Enumeration (CVE)', 'Security Content Automation Protocol (SCAP)', 'Open Vulnerability Assessment Language'], 1,
  'CVE is the IDENTIFIER that lets everyone name the same flaw. CVSS is the SCORE describing how severe it is — one is a label, the other a measurement.'),
q('4.3', 'The most direct vulnerability response, applying the vendor\'s fix to eliminate the flaw entirely, is called what?',
  ['Compensating controls', 'Patching', 'Insurance', 'Exceptions and exemptions'], 1,
  'Patching removes the vulnerability rather than reducing its exposure. Every other 4.3 response leaves the flaw present and manages the consequence instead.'),
q('4.3', 'A vulnerable system that cannot be patched is moved to a restricted network zone so that fewer systems can reach it. Which vulnerability response is this?',
  ['Patching', 'Segmentation', 'Insurance', 'Rescanning'], 1,
  'Segmentation reduces EXPOSURE without removing the flaw. It is listed as a vulnerability response in 4.3 and as a mitigation in 2.5 — same control, two objectives.'),
q('4.3', 'The general confirmation that a remediation actually resolved the finding, drawing on rescans and audit evidence, is called what?',
  ['Rescanning', 'Verification', 'Audit', 'Confirmation'], 1,
  'Verification is the overall conclusion that the fix worked. Rescanning and audit are the two specific activities that produce the evidence for it.'),

/* 4.4 */
q('4.4', 'Logs from hundreds of separate systems are collected into one central platform so they can be searched together. Which 4.4 activity is this?',
  ['Archiving', 'Log aggregation', 'Alerting', 'Scanning'], 1,
  'Log aggregation is the COLLECTION step and comes first. Correlation and alerting act on what aggregation has gathered — without it there is nothing to correlate.'),
q('4.4', 'When correlated events match a defined condition, the platform notifies the on-call analyst. Which 4.4 activity is this?',
  ['Log aggregation', 'Alerting', 'Reporting', 'Archiving'], 1,
  'Alerting notifies a human that something needs attention NOW. Reporting summarises after the fact — urgency is the discriminator between the two activities.'),
q('4.4', 'The monitoring platform actively probes systems to gather configuration and vulnerability state rather than waiting for them to report in. Which 4.4 activity is this?',
  ['Log aggregation', 'Scanning', 'Alerting', 'Archiving'], 1,
  'Scanning actively interrogates systems. Log aggregation passively receives what systems send — push versus pull is the distinction the objectives draw.'),
q('4.4', 'The security team produces a monthly summary of alert volumes, mean time to respond and coverage gaps for management. Which 4.4 activity is this?',
  ['Alerting', 'Reporting', 'Archiving', 'Log aggregation'], 1,
  'Reporting summarises for an audience over a period. Alerting demands immediate attention — reporting is retrospective and aggregate, alerting is immediate and specific.'),

/* 5.2 */
q('5.2', 'Which term names the expected monetary loss from one occurrence of a risk event?',
  ['Annualized loss expectancy (ALE)', 'Single loss expectancy (SLE)', 'Annualized rate of occurrence (ARO)', 'Exposure factor'], 1,
  'SLE is per EVENT and equals asset value x exposure factor. ALE is per YEAR. Stopping at the SLE when the question asked for annual loss is the most common error.'),
q('5.2', 'Which term names the expected total monetary loss per year from a given risk?',
  ['Single loss expectancy (SLE)', 'Annualized loss expectancy (ALE)', 'Annualized rate of occurrence (ARO)', 'Mean time between failures (MTBF)'], 1,
  'ALE = SLE x ARO and is the figure compared against the annual cost of a control. If a control costs more than the ALE, the numbers do not justify it.'),
q('5.2', 'Which term names how many times per year a risk event is expected to occur?',
  ['Probability', 'Annualized rate of occurrence (ARO)', 'Likelihood', 'Exposure factor'], 1,
  'ARO is a COUNT per year and may be a fraction — once in twenty years is 0.05. Probability and likelihood express chance rather than frequency.'),
q('5.2', 'Which term names the proportion of an asset\'s value that is lost when a risk event occurs?',
  ['Annualized rate of occurrence (ARO)', 'Exposure factor', 'Impact', 'Single loss expectancy (SLE)'], 1,
  'Exposure factor is the PROPORTION and is the multiplier in the SLE formula. Impact is the qualitative consequence rather than a number you can multiply.'),

/* 5.4 */
q('5.4', 'Which privacy term names the identifiable living individual whom a set of personal data describes?',
  ['Data owner', 'Data subject', 'Controller', 'Processor'], 1,
  'The data subject is the PERSON the data is about, and the holder of rights such as erasure. The owner, controller and processor are all organisational roles.'),
];
