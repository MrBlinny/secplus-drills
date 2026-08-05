# Deep dives — reference tables

Long-form reference for the material SY0-701 examines heavily but the objectives document only gestures at. Everything here is **supplementary**: it is not an enumerated objective term, so it will not be a credited answer *by itself* — but it is what a scenario question assumes you already know.

Each section is keyed to the objective it serves, so Learn mode can hang it off the right page.

---

## 4.5 — Ports and protocols

Objective 4.5 says "implementation of secure protocols — protocol selection, port selection, transport method" and lists nothing. This is the table behind it. Questions that give you a port number and ask what is exposed, or ask which port to open, are common and are pure recall.

### The insecure/secure pairs — the highest-value rows

| Insecure | Port | Secure replacement | Port |
|---|---|---|---|
| FTP | 20/21 TCP | FTPS | 989/990 TCP |
| FTP | 20/21 TCP | SFTP (over SSH) | 22 TCP |
| Telnet | 23 TCP | SSH | 22 TCP |
| HTTP | 80 TCP | HTTPS | 443 TCP |
| SMTP | 25 TCP | SMTPS | 465 TCP |
| POP3 | 110 TCP | POP3S | 995 TCP |
| IMAP | 143 TCP | IMAPS | 993 TCP |
| LDAP | 389 TCP | LDAPS | 636 TCP |
| SNMP v1/v2c | 161 UDP | SNMPv3 | 161 UDP |
| Syslog | 514 UDP | Syslog over TLS | 6514 TCP |
| DNS | 53 | DNSSEC / DoH | 53 / 443 |

**SFTP vs FTPS** is a favourite: SFTP is file transfer *inside an SSH session* on port 22. FTPS is ordinary FTP wrapped in TLS on 989/990. Different protocols, similar names.

**SNMPv3** does not change port — it adds authentication and encryption on the same 161. If a question offers "move SNMP to a different port" as a hardening step, that is the distractor; the answer is v3.

### Authentication and directory

| Port | Protocol | Note |
|---|---|---|
| 49 TCP | TACACS+ | Cisco, encrypts the **whole payload**, separates AAA |
| 88 | Kerberos | Ticket-granting; the TGT lives here |
| 389 TCP/UDP | LDAP | Directory queries |
| 636 TCP | LDAPS | LDAP over TLS |
| 1812 / 1813 UDP | RADIUS | 1812 authentication, 1813 accounting |
| 1645 / 1646 UDP | RADIUS (legacy) | Older port pair, still seen |
| 3268 TCP | Global Catalog | Active Directory forest-wide queries |

**RADIUS vs TACACS+** is examinable. RADIUS encrypts only the *password* and combines authentication with authorization. TACACS+ encrypts the *entire payload* and separates all three A's. RADIUS is the one named in objective 4.1 under wireless security settings.

### Everything else worth knowing

| Port | Service |
|---|---|
| 53 TCP/UDP | DNS — UDP for queries, TCP for zone transfers |
| 67 / 68 UDP | DHCP server / client |
| 69 UDP | TFTP — no authentication at all |
| 123 UDP | NTP |
| 135, 137–139 | RPC / NetBIOS — classic lateral movement, block at the perimeter |
| 143 TCP | IMAP |
| 162 UDP | SNMP **traps** (device-initiated) |
| 445 TCP | SMB — the port ransomware worms love |
| 500 UDP | ISAKMP / IKE — IPSec key exchange |
| 4500 UDP | IPSec NAT traversal |
| 587 TCP | SMTP submission (with STARTTLS) |
| 1433 TCP | Microsoft SQL Server |
| 1521 TCP | Oracle |
| 3306 TCP | MySQL |
| 3389 TCP | RDP — the most-attacked remote access port |
| 5060 / 5061 | SIP / SIP-TLS |

IPSec's **ESP** and **AH** are IP *protocol numbers* 50 and 51, not ports — which is exactly why IPSec breaks through NAT and needs NAT-T on UDP 4500.

---

## 1.4 — Cryptographic algorithms: which is which

Objective 1.4 says "algorithms" and names none. Questions name them constantly. The only thing you need reliably is **which family each belongs to** — symmetric, asymmetric, or hash.

### Symmetric — one shared key, fast, bulk data

| Algorithm | Note |
|---|---|
| **AES** | The answer to almost any "which symmetric cipher" question. 128/192/256-bit. Block cipher. |
| 3DES | Legacy, deprecated |
| DES | Broken, 56-bit |
| RC4 | Stream cipher, broken, was used in WEP and early TLS |
| Blowfish / Twofish | Older block ciphers |
| ChaCha20 | Modern stream cipher |

### Asymmetric — key pair, slow, used to exchange keys and sign

| Algorithm | Does |
|---|---|
| **RSA** | Encryption *and* signatures. Large keys (2048+). |
| **ECC** | Same strength, much smaller keys — the answer for **mobile and IoT** |
| **Diffie-Hellman (DH)** | Key *exchange* only. Cannot encrypt or sign. |
| DHE / ECDHE | **Ephemeral** variants — these are what give you perfect forward secrecy |
| DSA / ECDSA | Signatures only |

**Perfect forward secrecy** comes from the *ephemeral* (E) versions: a new key per session means yesterday's traffic stays safe if today's private key leaks. If a question mentions PFS, look for DHE or ECDHE.

### Hashing — one way, fixed length, integrity

| Algorithm | Output | Status |
|---|---|---|
| **SHA-256 / SHA-2** | 256-bit | Current standard |
| SHA-1 | 160-bit | Broken by collision |
| MD5 | 128-bit | Broken by collision |
| HMAC | varies | Hash **plus a key** — proves integrity *and* origin |
| RIPEMD | varies | Rare |

### Password hashing — deliberately slow

**PBKDF2**, **bcrypt**, **scrypt**, **Argon2**. These are key-stretching functions. If the scenario is "storing user passwords", a plain fast hash like SHA-256 is the *wrong* answer even though it is a good hash.

### Modes and the rest

- **GCM** — the mode that gives you encryption *and* authentication together. AES-GCM is the modern default.
- **CBC** — needs an initialization vector; each block chains to the last.
- **ECB** — never the right answer; identical plaintext blocks produce identical ciphertext.
- **XOR** — the primitive underneath, not a cipher on its own.

### Rules of thumb the exam rewards

- Encrypt **data** with symmetric; encrypt **keys** with asymmetric.
- Confidentiality → encryption. Integrity → hash. Both integrity *and* origin → HMAC or a digital signature.
- A **digital signature** is the sender's *private* key applied to a *hash* of the message. That single sentence answers a surprising number of questions.
- Small device, limited power, need strong crypto → **ECC**.

---

## 4.1 — Wireless and authentication protocols

Objective 4.1 lists "cryptographic protocols" and "authentication protocols" without naming any.

### Wi-Fi security, oldest to newest

| Standard | Encryption | Status |
|---|---|---|
| WEP | RC4 | Broken — weak IV, recoverable key |
| WPA | TKIP | Deprecated |
| WPA2 | **CCMP/AES** | Still common; PSK handshake is crackable offline |
| **WPA3** | **CCMP/AES + SAE** | Current. Objective 4.1 names this one specifically. |

**WPA3's headline change is SAE** — Simultaneous Authentication of Equals, which replaces the WPA2 pre-shared key handshake and defeats offline dictionary attacks. It also adds forward secrecy.

**WPS** is the push-button convenience feature with an eight-digit PIN that can be brute-forced in hours. Disabling it is a standard hardening answer.

### Enterprise wireless — the EAP family

**802.1X** is the port-based access control framework. **EAP** is what runs inside it. **RADIUS** is the back-end server that makes the decision.

| Method | Needs |
|---|---|
| **EAP-TLS** | Certificates on **both** server and client — the most secure, the most work |
| **PEAP** | Server certificate only; builds a TLS tunnel, then password auth inside |
| **EAP-TTLS** | Server certificate only; tunnels a legacy method inside |
| **EAP-FAST** | Cisco; uses a Protected Access Credential instead of certificates |
| LEAP | Cisco legacy, weak, do not select |

If a question asks for the *strongest* wireless authentication, the answer is **EAP-TLS** — mutual certificates.

### Legacy authentication protocols

| Protocol | Weakness |
|---|---|
| **PAP** | Sends the password in **cleartext** |
| **CHAP** | Challenge-response, no cleartext; periodic re-authentication |
| MS-CHAPv2 | Microsoft's version, now considered weak |
| **Kerberos** | Ticket-based, mutual authentication, needs clock sync (hence NTP) |

**Kerberos is time-sensitive.** If a scenario mentions authentication failing after a clock drift, that is Kerberos.

### One-time passwords

- **HOTP** — HMAC-based, counter-driven. Valid until used.
- **TOTP** — Time-based, usually a 30-second window. This is what an authenticator app shows.

---

## 4.9 — Log sources and what each one actually proves

The exam gives you a scenario and asks which source answers the question. The trap is picking a source that *contains related data* but cannot prove the specific claim.

| Question being asked | Source that proves it |
|---|---|
| Did this host talk to that IP? | Firewall logs / network logs |
| **What was actually said** in that conversation? | **Packet capture** |
| Who logged on, when, and did it fail? | **OS-specific security logs** |
| What did the security agent see the process do? | Endpoint logs |
| Which detection rule fired? | IPS/IDS logs |
| What did the application itself record? | Application logs |
| Who created this document and where? | **Metadata** |
| Which hosts have this vulnerability? | Vulnerability scans |
| What is the trend across the estate? | Dashboards / automated reports |

**The distinction that carries the most marks:** network logs prove a conversation *happened*; only a packet capture proves *what was in it*. If a stem asks for content, nothing but a capture will do.

**Metadata travels inside the artifact.** EXIF in a photo, author and revision history in a document. Logs are written *about* an artifact from outside it.

**Time is the connective tissue.** Correlating across sources requires synchronised clocks — which is why NTP appears in security discussions at all, and why a SIEM normalises timestamps as its first job.

---

## 5.1 — Frameworks, regulations and standards to recognise

Objective 5.1 says external considerations are "regulatory, legal, industry, local/regional, national, global" and names no specific instrument. SY0-701 will not ask you to recite GDPR articles — but it does expect you to recognise a name in a stem and know what *kind* of thing it is.

### Regulations — legally binding

| Name | Scope | Cares about |
|---|---|---|
| **GDPR** | EU residents' data, wherever processed | Consent, data subject rights, **right to be forgotten**, 72-hour breach notification, controller vs processor |
| **HIPAA** | US healthcare | PHI — protected health information |
| **SOX** | US public companies | Financial reporting integrity, retention |
| **GLBA** | US financial institutions | Customer financial privacy |
| **FERPA** | US education | Student records |
| **CCPA/CPRA** | California residents | Consumer data rights, opt-out of sale |

GDPR is the one whose vocabulary leaks directly into objective 5.4: *data subject*, *controller vs processor*, *right to be forgotten*, *data inventory and retention*.

### Industry standards — contractually binding, not law

- **PCI DSS** — payment card data. Enforced by the card brands through your acquiring bank, not by a government. Non-compliance consequences are **fines and loss of the ability to process cards**, which maps onto 5.4's "contractual impacts" and "loss of license".

### Frameworks — voluntary, you adopt them

| Name | What it is |
|---|---|
| **NIST Cybersecurity Framework** | Identify · Protect · Detect · Respond · Recover (+ Govern in 2.0) |
| **NIST SP 800-53** | Control catalogue for US federal systems |
| **NIST SP 800-61** | Incident handling guide — the source of the IR lifecycle |
| **ISO/IEC 27001** | Certifiable information security management system |
| **ISO/IEC 27002** | The control guidance that accompanies 27001 |
| **CIS Controls / CIS Benchmarks** | Prioritised controls; benchmarks are the hardening baselines in objective 4.4 |
| **SOC 2** | Audit report on a service organisation's controls — what a vendor hands you under 5.3 |
| **MITRE ATT&CK** | Adversary tactics and techniques; the basis of threat hunting and TTPs |
| **Cyber Kill Chain** | Lockheed Martin's seven-stage intrusion model |
| **OWASP Top 10** | Web application risks |

### The distinction that gets tested

**Regulation** = a government can fine you. **Standard** = a contract can penalise you. **Framework** = you chose it, and the consequence of ignoring it is only that you are less organised.

There is no such thing as being "NIST CSF certified". ISO 27001 *is* certifiable. SOC 2 produces a *report*, not a certificate. If an option offers certification against a voluntary framework, look closely — that is often the distractor.
