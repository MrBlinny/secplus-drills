# Security+ SY0-701 — the cram sheet

One section per objective, in blueprint order. This is **not** a textbook: definitions are assumed. What is written here is the *discriminator* — the binary test that separates a term from the term people reach for instead.

Read `objectives.md` for what the credited answers are. Read this for how to tell them apart.

---

## How to read a Security+ question

**The qualifier does the work.** BEST, FIRST, MOST likely, GREATEST. If a stem has one, more than one option is genuinely correct and the qualifier is the whole question. FIRST wants the earliest step not yet taken. BEST wants the option addressing the stated cause, not a symptom.

**CompTIA's word beats your word.** Distractors are written from adjacent real-world vocabulary. *Mantrap* for access control vestibule, *script kiddie* for unskilled attacker, *white box* for known environment, *PUP* for bloatware. When two options both look right, pick the one that appears in the objectives document.

**A sensible option that is nowhere in the objectives is a distractor.** This is the dangerous one for anyone with real experience: the option reads as good practice and you pick it because it is what you would actually do.

**Watch the domain the question lives in.** The same word is credited differently depending on objective. *Encryption* is a cryptographic solution in 1.4, a mitigation in 2.5, a method to secure data in 3.3, and a standard in 5.1. *Penetration testing* is an identification method in 4.3, a vendor assessment in 5.3, and an audit type in 5.5.

---

## Numbers to have cold

| | |
|---|---|
| Exam | SY0-701, max 90 questions, 90 minutes, 750 on 100–900 |
| Domain weights | 1.0 = 12% · 2.0 = 22% · 3.0 = 18% · **4.0 = 28%** · 5.0 = 20% |
| SLE | asset value × exposure factor |
| ALE | SLE × ARO |
| ARO | occurrences per **year** |
| RTO | how long until we are running again — looks **forward** |
| RPO | how much data we can afford to lose — looks **backward** |
| MTTR | mean time to repair — how long a fix takes |
| MTBF | mean time between failures — how long it runs before breaking |

Domain 4 alone is more than a quarter of the paper. Domains 4 and 2 together are half of it.

---

## 1.1 Compare and contrast various types of security controls.

Two separate lists, and questions routinely ask for one while offering the other.

**Category = what kind of thing it is.** Technical (a machine does it) · Managerial (paperwork that governs — policy, risk assessment, planning) · Operational (a person does it day to day — guards, training, awareness) · Physical (a wall, a lock, a fence).

**Type = what it does to the attack.** Preventive (stops it) · Deterrent (discourages before the fact) · Detective (notices it) · Corrective (repairs after) · Compensating (substitutes for a control you cannot deploy) · Directive (tells someone what to do).

Discriminators:
- **Deterrent vs preventive** — can it actually stop you? A warning banner and a "beware of dog" sign cannot. A lock can.
- **Compensating vs corrective** — compensating exists because the control you *wanted* is not available. Corrective exists because damage already happened.
- **Directive vs managerial** — directive is a control *type*, managerial is a *category*. A policy is both, and the question tells you which axis it wants.
- **Recovery is not a control type.** It is an incident response phase. The six types do not include it.

A firewall is the canonical exam answer: **preventive, technical**.

## 1.2 Summarize fundamental security concepts.

**CIA.** Confidentiality = who can read it. Integrity = has it changed. Availability = can I get it.

**Non-repudiation is not integrity.** Integrity proves the data did not change. Non-repudiation proves *who* acted and stops them denying it. Mechanism: **digital signature**. If the requirement is proving who did something, do not reach for encryption.

**AAA.** Authentication (who are you) · Authorization (what may you do) · Accounting (what did you do). The objectives split it further into authenticating *people*, authenticating *systems*, and authorization models.

**Zero Trust — the single most-tested split in Domain 1.**

| Control Plane — *decides* | Data Plane — *acts* |
|---|---|
| Adaptive identity | Implicit trust zones |
| Threat scope reduction | Subject/System |
| Policy-driven access control | **Policy Enforcement Point** |
| Policy Administrator | |
| **Policy Engine** | |

Policy **Engine** makes the decision. Policy **Administrator** communicates and executes it. Policy **Enforcement Point** is the thing in the traffic path that allows or blocks — and it is the only one of the three on the Data Plane.

**Deception ladder, smallest to largest:** honeytoken (one record or credential) → honeyfile (one file) → honeypot (one system) → honeynet (a network of them).

**Physical:** bollards stop *vehicles*; fencing defines a perimeter for *people*; an access control vestibule is the double-door that defeats tailgating — CompTIA does not use the word *mantrap*. Sensor types: infrared, pressure, microwave, ultrasonic.

## 1.3 Explain the importance of change management processes and the impact to security.

The exam treats change management as a governance topic, not a technical one.

- **Backout plan** is scoped to one change. A disaster recovery plan is scoped to the site. Do not swap them.
- **Maintenance window** is the *permission* to cause disruption. **Downtime** is the *consequence*. The objectives list both separately.
- **Impact analysis** happens before approval. **Test results** are the evidence you bring to the approval.
- **Version control** is the artifact that records what the file looked like before; change management is the process around it.
- Technical implications worth knowing by name: allow lists/deny lists, restricted activities, service restart vs application restart, **legacy applications**, **dependencies**.

## 1.4 Explain the importance of using appropriate cryptographic solutions.

**Symmetric vs asymmetric.** One key both ways = symmetric (AES). Key pair = asymmetric (RSA, ECC, Diffie-Hellman). Asymmetric is slow, so in practice it exchanges a symmetric key and then gets out of the way.

**The three that look alike:**
- **Hashing** — one way, fixed length, proves integrity.
- **Salting** — random value added *before* hashing. Defeats precomputed rainbow tables.
- **Key stretching** — deliberately slow hashing. Defeats brute force by making each guess cost.

Salting attacks the attacker's *precomputation*; stretching attacks their *time*.

**Obfuscation, three ways:**
- **Steganography** hides the *existence* of the message (inside an image).
- **Tokenization** replaces the value with a meaningless reference; the real value lives in a vault. The original leaves the system.
- **Data masking** hides characters in place — the real value is still underneath. It is a display control.

**TPM vs HSM.** TPM is one chip on one motherboard, tied to that machine. HSM is a separate appliance serving many systems. **Secure enclave** is an isolated region of a processor.

**Certificates.** CRL is a *list you download*; OCSP is a *question you ask* about one certificate. Same job, opposite mechanism. You generate the **CSR**; the **CA** signs it. A **wildcard** covers `*.example.com`; a SAN certificate lists specific unrelated names. **Key escrow** is a third party holding a copy of the private key so it can be recovered.

**Encryption levels**, largest to smallest: full-disk → partition → volume → file → database → record.

---

## 2.1 Compare and contrast common threat actors and motivations.

Six actors: nation-state · unskilled attacker · hacktivist · insider threat · organized crime · **shadow IT**.

- **Shadow IT is on the actor list** and it is the one with no malicious intent. It gets dropped by people reproducing this from intuition.
- **Unskilled attacker**, not script kiddie. That word is not in SY0-701.
- **Nation-state** is the actor; APT describes the behaviour and lives only in the acronym list.

Attributes that separate them: internal/external · resources/funding · level of sophistication/capability. Nation-state is the top of all three.

Ten motivations, and two get forgotten: **Ethical** (the researcher) and **War**. The rest: data exfiltration, espionage, service disruption, blackmail, financial gain, philosophical/political beliefs, revenge, disruption/chaos.

Espionage steals to *know*; data exfiltration steals to *have*. Philosophical/political belief means there is a cause; disruption/chaos means there is not.

## 2.2 Explain common threat vectors and attack surfaces.

A **vector** is how they get in. Do not confuse with 2.3 vulnerabilities, which are what is weak.

Social engineering, the ten:

| Term | The tell |
|---|---|
| Phishing | Email, broad |
| Vishing | **V**oice |
| Smishing | **S**MS |
| Misinformation/disinformation | False content as the attack itself |
| Impersonation | Claiming to be a specific *person* |
| Business email compromise | Trusted internal identity, targets a *business process* |
| Pretexting | The invented *story* that makes the ask plausible |
| Watering hole | Compromise a site the victim *visits* |
| Brand impersonation | Looking like the *company* |
| Typosquatting | The *domain name* is one letter off |

Watering hole vs supply chain: watering hole compromises what they **visit**, supply chain compromises what they **buy or install**.

Other surfaces to name exactly: image-based, file-based, voice call, removable device, **vulnerable software (client-based vs agentless)**, unsupported systems, unsecure networks (wireless/wired/Bluetooth), **open service ports**, **default credentials**, supply chain (MSPs, vendors, suppliers).

## 2.3 Explain various types of vulnerabilities.

- **Race condition** — if the stem mentions timing between two operations, this is it. TOC = time-of-check, TOU = time-of-use.
- **VM escape** crosses the hypervisor boundary. **Resource reuse** is memory or storage handed to a new tenant with the old data still in it.
- **Side loading** installs one app around the store. **Jailbreaking** removes the OS restrictions entirely.
- **Zero-day**: no patch exists *yet*. **End-of-life**: no patch will *ever* come. **Legacy**: still running, still supported-ish, nobody wants to touch it.
- **Malicious update** is listed under Application. If the update mechanism is the vector, that is the word — not "supply chain".
- **Memory injection** and **buffer overflow** are both application; buffer overflow also reappears as a 2.4 application *attack*.

## 2.4 Given a scenario, analyze indicators of malicious activity.

**Malware, the nine.** Ransomware · Trojan · Worm · Spyware · **Bloatware** · Virus · Keylogger · Logic bomb · Rootkit.

- **Worm** self-propagates. **Virus** needs a host file and a user. **Trojan** needs you to run it believing it is something else.
- **Logic bomb** is defined by its *trigger*.
- **Rootkit** is defined by *concealment* at privileged level.
- **Bloatware** is on the list; PUP is not.

**Attack families — match the objectives' own grouping:**
- Physical: brute force (the door), **RFID cloning**, environmental.
- Network: DDoS (**amplified** = response much larger than request; **reflected** = response sent to the spoofed victim), DNS attacks, wireless, on-path, **credential replay**, malicious code.
- Application: injection, buffer overflow, replay, privilege escalation, forgery, **directory traversal**.
- Cryptographic: **downgrade** (forced to a weaker cipher), **collision** (two inputs, one hash), **birthday** (the probability attack that finds a collision efficiently).
- Password: **spraying** (one password, many accounts — dodges lockout) vs **brute force** (many passwords, one account).

**The nine indicators — what you SEE, not what happened:** account lockout · concurrent session usage · blocked content · **impossible travel** · resource consumption · resource inaccessibility · **out-of-cycle logging** · published/documented · **missing logs**.

Impossible travel is geography vs time. Concurrent session usage is two live sessions regardless of place. Out-of-cycle logging means the log exists at the *wrong time*; missing logs means it is not there at all.

## 2.5 Explain the purpose of mitigation techniques used to secure the enterprise.

Segmentation divides the network into zones; **isolation** cuts one host off entirely. **Application allow list** names the specific software permitted; **configuration enforcement** makes settings stick. **Decommissioning** is the 2.5 process for retiring a system — sanitization is the 4.2 step inside it.

**Hardening techniques, the seven:** encryption · installation of endpoint protection · host-based firewall · **HIPS** · disabling ports/protocols · default password changes · removal of unnecessary software.

---

## 3.1 Compare and contrast security implications of different architecture models.

- **Responsibility matrix** divides *duties* between you and the cloud provider. An SLA commits to *performance* and is a 5.3 agreement type.
- **IaC** is the 3.1 architecture term for defining infrastructure in version-controlled files. Automation is the 4.7 benefit you get from it.
- **Air-gapped** = physical isolation, no cable. **Logical segmentation** = VLANs on shared hardware. **SDN** separates the control plane from the data plane in networking.
- **Serverless** removes the server you manage; **microservices** split the application; **containerization** shares one OS kernel; **virtualization** gives each guest its own OS.
- **ICS/SCADA**, **RTOS**, **embedded systems** and **IoT** are all "can't patch it easily" architectures — expect them paired with the considerations *inability to patch* and *patch availability*.
- The twelve considerations are examinable as a list: availability, resilience, cost, responsiveness, scalability, ease of deployment, **risk transference**, ease of recovery, patch availability, inability to patch, power, compute.

## 3.2 Given a scenario, apply security principles to secure enterprise infrastructure.

- **Jump server**: you log *into* it to reach a secure zone. **Proxy**: it forwards on your behalf and you never log in.
- **Fail-open** favours availability, **fail-closed** favours security. Name the property the scenario prioritises.
- **Active vs passive** is whether the device can act. **Inline vs tap/monitor** is where it sits in the traffic path. Two different axes; questions swap them.
- **802.1X** is port-based authentication (3.2). **NAC** is the enterprise capability built on it (4.5). **EAP** is the framework 802.1X carries.
- Firewalls: **WAF** understands HTTP deeply · **NGFW** adds identity and application awareness · **UTM** is many functions in one box · **Layer 4** filters ports, **Layer 7** understands the application.
- **SD-WAN** is the networking. **SASE** is SD-WAN with the security stack folded in and delivered from the cloud.

## 3.3 Compare and contrast concepts and strategies to protect data.

**Three data states only:** at rest (disk) · in transit (wire) · in use (memory).

**Six classifications:** sensitive · confidential · public · restricted · private · critical. They all sound alike in English and the exam still wants the exact word.

**Data types:** regulated · trade secret · intellectual property · legal information · financial information · human- and non-human-readable. Trade secret is the subset of IP whose value depends on never being published.

**Sovereignty vs geolocation.** Sovereignty is the *legal consequence* of where the data sits. Geolocation is just knowing where it is. **Geographic restrictions** is the control you apply.

## 3.4 Explain the importance of resilience and recovery in security architecture.

**Sites:** hot (running now) · warm (equipment, needs data and time) · cold (empty room with power). **Geographic dispersion** is how far apart they are.

**Multi-cloud** = more than one *provider*. **Platform diversity** = more than one *technology stack*.

**Backups:** snapshot is a *moment you can return to*; replication is *continuous copying elsewhere*; **journaling** logs the changes themselves so you can rebuild to any point.

**Testing:** tabletop is discussion only · **fail over** actually switches · **simulation** exercises systems or people · **parallel processing** runs both at once and compares.

**Load balancing vs clustering** — balancing spreads load across independent nodes; clustering makes several nodes act as one system.

---

## 4.1 Given a scenario, apply common security techniques to computing resources.

- **Secure baseline** is yours: establish, deploy, maintain. **Benchmarks** (4.4) are the external standard you measure against.
- **Site survey** is the activity; **heat map** is the output it produces.
- Deployment models: **BYOD** employee owns it · **COPE** company owns it, personal use allowed · **CYOD** employee chooses from an approved list.
- **Input validation** runs at runtime on data. **Static code analysis** runs before deployment on source. **Code signing** proves origin and integrity of the binary.
- **Sandboxing** exists to *observe* safely; isolation exists to *contain*.
- **WPA3** brings SAE, replacing WPA2's pre-shared key handshake.

## 4.2 Explain the security implications of proper hardware, software, and data asset management.

The whole objective is a lifecycle: acquisition/procurement → assignment (ownership, classification) → monitoring (inventory, enumeration) → disposal.

**Sanitization** keeps the hardware usable. **Destruction** does not. **Certification** is the signed proof the disposal vendor did it. **Data retention** is how long you were required to keep it in the first place.

## 4.3 Explain various activities associated with vulnerability management.

- **CVE is the identifier; CVSS is the score.** CVE-2024-1234 has a CVSS of 9.8.
- **False positive** — the scanner cried wolf. **False negative** — it stayed silent and should not have. "Positive" always means the scanner *said something*.
- **Static analysis** checks code you wrote · **dynamic analysis** runs it · **package monitoring** watches third-party dependencies.
- **Bug bounty** sits *under* responsible disclosure and adds the payment.
- Threat feeds: **OSINT** · proprietary/third-party · information-sharing organization · dark web.
- Response options are not all technical: patching, **insurance**, segmentation, **compensating controls**, **exceptions and exemptions**.
- Validation: **rescanning** · audit · verification.

## 4.4 Explain security alerting and monitoring concepts and tools.

- **Alert tuning** changes the *rule*. **Quarantine** acts on the *file or host*.
- **SCAP** is the machine-readable format; a **benchmark** is content expressed in it.
- **NetFlow** is metadata about conversations. A **packet capture** (4.9) is the full content.
- **SIEM** aggregates and correlates. **DLP** watches data leaving. **SNMP traps** are device-initiated alerts.
- Activities in order of a pipeline: log aggregation → alerting → scanning → reporting → archiving → alert response and remediation/validation.

## 4.5 Given a scenario, modify enterprise capabilities to enhance security.

**Email, the three that always appear together:**
- **SPF** authorises the *sending server*.
- **DKIM** signs the *message*.
- **DMARC** is the *policy* on top that says what to do when either fails, and reports back.

Other splits:
- **DNS filtering** blocks the *lookup*. A **web filter** inspects the request and can categorise the page.
- **FIM** watches specific files for change. **EDR/XDR** watches behaviour and can respond.
- **Group Policy** is the named Windows mechanism; **SELinux** is the Linux one.
- **UBA** baselines a person's own behaviour; SIEM correlates events from everywhere.
- Firewall constructs: rules · access lists · ports/protocols · **screened subnets**.
- IDS/IPS detect by **signatures** (known patterns) or **trends** (anomaly).

## 4.6 Given a scenario, implement and maintain identity and access management.

**The five access control schemes people mix up:**

| Scheme | Decided by |
|---|---|
| **Mandatory** | The system, by label/clearance. Nobody can override. |
| **Discretionary** | The data owner. |
| **Role-based** | Who you are — your job function. |
| **Rule-based** | A condition the system evaluates, regardless of who. |
| **Attribute-based** | Several properties combined — subject, object, environment. |

Role-based and rule-based both abbreviate to RBAC; the acronym list has both entries.

- **Identity proofing** happens *once* at enrolment. Authentication happens every login.
- **SSO** is one login across systems you own. **Federation** crosses an *organisational* boundary.
- **SAML** carries authentication assertions. **OAuth** grants delegated *authorisation*. **LDAP** is the directory protocol underneath.
- **Attestation** is confirming an identity or entitlement is still valid.
- **MFA factors:** something you know · something you have · something you are · **somewhere you are**.
- **PAM tools:** just-in-time permissions (time-boxed) · password vaulting (checked out) · ephemeral credentials (die after use).

## 4.7 Explain the importance of automation and orchestration related to secure operations.

- **Guard rails** constrain what an automated process may do. **Security groups** are the access grouping being managed.
- **Workforce multiplier** is about headcount capacity; **efficiency/time saving** is about the clock.
- The downsides are examinable too: complexity · cost · **single point of failure** · **technical debt** · ongoing supportability.

## 4.8 Explain appropriate incident response activities.

**Order is examinable.** Preparation → Detection → Analysis → **Containment** → **Eradication** → Recovery → Lessons learned.

Containment limits spread while the threat is still present; eradication removes it. "Patch the vulnerability" is the wrong answer while the attacker still has a live session.

**Forensics:**
- **Legal hold** is the *order* that triggers preservation. **Preservation** is the technical act.
- **Acquisition** is taking the copy. **Chain of custody** is the paperwork proving nobody tampered with it since.
- **E-discovery** is producing it for legal proceedings.

**Root cause analysis** finds the technical origin; **lessons learned** is the phase that decides what to change. **Threat hunting** starts from a hypothesis with no alert at all.

## 4.9 Given a scenario, use data sources to support an investigation.

Match the source to what it can actually prove:

| Source | Proves |
|---|---|
| Firewall logs | Allowed/denied connections at the perimeter |
| Application logs | What the app itself did |
| Endpoint logs | What the security agent saw on the host |
| **OS-specific security logs** | The operating system's own audit trail — logons |
| IPS/IDS logs | Which signature or anomaly fired |
| Network logs | That the conversation happened |
| **Metadata** | Author, timestamps, GPS — travels *inside* the artifact |
| **Packet captures** | The payload, byte for byte |

Network logs tell you a conversation happened; only a packet capture tells you what was said.

---

## 5.1 Summarize elements of effective security governance.

**The document hierarchy — the classic Domain 5 question:**
- **Policy** — what and why. Mandatory.
- **Standard** — the specific requirement that implements the policy. Mandatory.
- **Procedure** — the steps. Mandatory.
- **Guideline** — advisory. *Not* mandatory.

**Playbooks** are procedures scoped to one specific incident type.

**Roles for systems and data:** owner (accountable) · **controller** (decides purpose and means of processing) · **processor** (acts on the controller's instructions) · custodian/steward (day-to-day care).

Governance structures: boards · committees · government entities · centralized/decentralized. External considerations run local/regional → national → global.

## 5.2 Explain elements of the risk management process.

**The formulas.** SLE = asset value × exposure factor. ALE = SLE × ARO. If a stem hands you numbers and one option is a computed figure, the qualitative answer is the distractor.

- **ARO** is a count per year. **Probability** is a likelihood. **Exposure factor** is the *proportion* of the asset lost.
- **Risk appetite** is the strategic hunger — expansionary, conservative, neutral. **Risk tolerance** is the acceptable variance around it. **Risk threshold** is the line in the register.
- **Strategies:** transfer (insurance, contract) · accept (with an **exemption** or **exception** recorded) · avoid (don't do the activity) · mitigate (reduce it).
- **Risk register** holds key risk indicators, risk owners and risk thresholds.
- **Assessment cadence:** ad hoc · recurring · one-time · continuous.

**BIA outputs:** RTO (forward — time to be running) · RPO (backward — data you can lose) · MTTR (time to repair) · MTBF (time between failures).

## 5.3 Explain the processes associated with third-party risk assessment and management.

Three different questions that sound like one: assessing them *before* signing, *binding* them by contract, and *watching* them afterwards.

- **Right-to-audit clause** is *your* right, written into the contract. An **independent assessment** is a third party's report handed to you.
- **Due diligence** is the investigation before selection; **conflict of interest** is the thing that disqualifies.
- **Rules of engagement** say what a tester may *do*; the SOW says what they will *deliver*.

**Agreement types:**

| | |
|---|---|
| **SLA** | Performance commitments, with consequences |
| **MOU** | Non-binding statement of shared intent |
| **MOA** | Closer to binding — agreed responsibilities |
| **MSA** | Master terms covering many future jobs |
| **WO/SOW** | One specific engagement under the MSA |
| **NDA** | Confidentiality |
| **BPA** | Terms between business partners |

## 5.4 Summarize elements of effective security compliance.

**Consequences of non-compliance, the five:** fines · sanctions · reputational damage · **loss of license** · contractual impacts.

**Privacy vocabulary.** The **data subject** is the person the data is about. The **controller** decides purpose; the **processor** acts on instruction. **Right to be forgotten** is the subject's demand for erasure; **data retention** is your own schedule.

**Due diligence** is the investigating; **due care** is the acting on it. **Attestation and acknowledgement** is a formal statement that a control is in place.

## 5.5 Explain types and purposes of audits and assessments.

**Internal:** compliance · audit committee · self-assessments — the least independent thing on the list.
**External:** regulatory · examinations · assessment · **independent third-party audit**.

**Penetration testing vocabulary changed in SY0-701.** Known environment / partially known environment / unknown environment replaced white / grey / black box. Those old words are not on the list.

Also examinable: physical · offensive · defensive · integrated. **Reconnaissance** is passive (public sources only) or active (the moment you send a packet at the target).

## 5.6 Given a scenario, implement security awareness practices.

- **Campaigns** are what you run. **Recognizing a phishing attempt** is the skill you are building. **Responding to reported suspicious messages** is the process afterwards.
- Anomalous behaviour splits three ways: **risky** (knowingly) · **unexpected** (out of pattern) · **unintentional** (mistake).
- **Operational security** is not leaking your own information. **Situational awareness** is noticing threats around you.
- Training topics named in the objectives: policy/handbooks · situational awareness · insider threat · password management · **removable media and cables** · social engineering · operational security · **hybrid/remote work environments**.
- Reporting and monitoring is **initial** then **recurring**. The programme itself has **development** and **execution**.
