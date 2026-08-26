// Port facts for the cram deck.
//
// Port numbers and transport assignments are IANA facts, not anybody's prose:
// the usage notes here are written for this repo, deliberately short, and say
// what the port is FOR rather than restating the protocol name.
//
// `secure` names the encrypted sibling so the deck can drill the pairing that
// SY0-701 actually tests - 80/443, 21/989-990, 389/636, 143/993, 110/995,
// 514/6514. Knowing "LDAPS is 636" is worth more than knowing "636 is a port".

export const PORTS = [
  { port: '20', proto: 'FTP (data)', transport: 'TCP', enc: false, use: 'Carries the file contents on an FTP transfer.' },
  { port: '21', proto: 'FTP (control)', transport: 'TCP', enc: false, use: 'Carries the FTP commands. Credentials cross in cleartext.', secure: '989-990 (FTPS)' },
  { port: '22', proto: 'SSH', transport: 'TCP', enc: true, use: 'Encrypted remote shell. SFTP and SCP tunnel over this same port.' },
  { port: '22', proto: 'SFTP', transport: 'TCP', enc: true, use: 'File transfer inside an SSH tunnel. Not the same protocol as FTPS.' },
  { port: '22', proto: 'SCP', transport: 'TCP', enc: true, use: 'Command-line file copy inside an SSH tunnel.' },
  { port: '23', proto: 'Telnet', transport: 'TCP', enc: false, use: 'Cleartext remote shell. The answer whenever a question wants SSH instead.', secure: '22 (SSH)' },
  { port: '25', proto: 'SMTP', transport: 'TCP', enc: false, use: 'Mail sent between mail servers.', secure: '587 (SMTPS / submission)' },
  { port: '49', proto: 'TACACS+', transport: 'TCP', enc: true, use: 'Administrator login to network devices. Encrypts the whole payload and separates authentication from authorization.' },
  { port: '53', proto: 'DNS', transport: 'both', enc: false, use: 'Name resolution. UDP for queries, TCP for zone transfers and large responses.' },
  { port: '67', proto: 'DHCP (server)', transport: 'UDP', enc: false, use: 'Server side of dynamic address assignment.' },
  { port: '68', proto: 'DHCP (client)', transport: 'UDP', enc: false, use: 'Client side of dynamic address assignment.' },
  { port: '69', proto: 'TFTP', transport: 'UDP', enc: false, use: 'Trivial file transfer, no authentication. Often used to load device configs and firmware.' },
  { port: '80', proto: 'HTTP', transport: 'TCP', enc: false, use: 'Unencrypted web traffic.', secure: '443 (HTTPS)' },
  { port: '88', proto: 'Kerberos', transport: 'both', enc: true, use: 'Ticket-based domain authentication. The port behind Windows/AD single sign-on.' },
  { port: '110', proto: 'POP3', transport: 'TCP', enc: false, use: 'Retrieves mail and by default removes it from the server.', secure: '995 (POP3S)' },
  { port: '123', proto: 'NTP', transport: 'UDP', enc: false, use: 'Clock synchronisation. Skewed clocks break Kerberos and log correlation.' },
  { port: '135', proto: 'MSRPC', transport: 'both', enc: false, use: 'Microsoft remote procedure call endpoint mapper.' },
  { port: '137', proto: 'NetBIOS name service', transport: 'both', enc: false, use: 'Legacy Microsoft name-to-IP resolution.' },
  { port: '138', proto: 'NetBIOS datagram service', transport: 'UDP', enc: false, use: 'Legacy Microsoft connectionless LAN messaging.' },
  { port: '139', proto: 'NetBIOS session service', transport: 'TCP', enc: false, use: 'Legacy Microsoft connection-oriented file sharing.' },
  { port: '143', proto: 'IMAP', transport: 'TCP', enc: false, use: 'Retrieves mail and leaves it on the server, syncing across devices.', secure: '993 (IMAPS)' },
  { port: '161', proto: 'SNMP', transport: 'UDP', enc: false, use: 'Polls network devices for status. v1/v2c send the community string in cleartext; v3 adds authentication and encryption.' },
  { port: '162', proto: 'SNMP trap', transport: 'UDP', enc: false, use: 'Unsolicited alert pushed FROM the device TO the manager. The discriminator against 161 is direction.' },
  { port: '389', proto: 'LDAP', transport: 'both', enc: false, use: 'Directory lookups, unencrypted.', secure: '636 (LDAPS)' },
  { port: '443', proto: 'HTTPS', transport: 'TCP', enc: true, use: 'Web traffic over TLS. HTTP/3 carries it over QUIC on UDP.' },
  { port: '445', proto: 'SMB', transport: 'TCP', enc: false, use: 'Windows file and printer sharing. The port ransomware worms move across.' },
  { port: '500', proto: 'IKE / ISAKMP', transport: 'UDP', enc: true, use: 'Negotiates the keys for an IPsec tunnel. Not the tunnel itself.' },
  { port: '514', proto: 'Syslog', transport: 'UDP', enc: false, use: 'Ships log events to a central collector, unencrypted and unacknowledged.', secure: '6514 (syslog over TLS)' },
  { port: '554', proto: 'RTSP', transport: 'TCP', enc: false, use: 'Controls a streaming media session - play, pause, seek.' },
  { port: '587', proto: 'SMTPS / submission', transport: 'TCP', enc: true, use: 'Authenticated mail submission from a client, over TLS.' },
  { port: '636', proto: 'LDAPS', transport: 'both', enc: true, use: 'Directory lookups over TLS.' },
  { port: '989-990', proto: 'FTPS', transport: 'TCP', enc: true, use: 'FTP wrapped in TLS. Distinct from SFTP, which is SSH on 22.' },
  { port: '993', proto: 'IMAPS', transport: 'TCP', enc: true, use: 'IMAP over TLS.' },
  { port: '995', proto: 'POP3S', transport: 'TCP', enc: true, use: 'POP3 over TLS.' },
  { port: '1433', proto: 'MS SQL', transport: 'TCP', enc: false, use: 'Microsoft SQL Server. Should never be reachable from the internet.' },
  { port: '1701', proto: 'L2TP', transport: 'UDP', enc: false, use: 'VPN tunnelling with no encryption of its own - it is paired with IPsec to get any.' },
  { port: '1723', proto: 'PPTP', transport: 'TCP', enc: false, use: 'Legacy Microsoft VPN tunnel. Considered broken; the answer when a question wants it replaced.' },
  { port: '1812', proto: 'RADIUS (authentication)', transport: 'UDP', enc: false, use: 'Authenticates VPN and wireless users. Encrypts only the password field, not the whole payload - the discriminator against TACACS+.' },
  { port: '1813', proto: 'RADIUS (accounting)', transport: 'UDP', enc: false, use: 'Session accounting records, separate from the auth port.' },
  { port: '2427/2727', proto: 'MGCP', transport: 'both', enc: false, use: 'Controls VoIP media gateways.' },
  { port: '3389', proto: 'RDP', transport: 'TCP', enc: true, use: 'Windows graphical remote desktop. Heavily targeted; belongs behind a VPN or jump server.' },
  { port: '5004-5005', proto: 'RTP / RTCP', transport: 'UDP', enc: false, use: 'Carries the actual VoIP audio and video stream and its timing control.' },
  { port: '5060', proto: 'SIP', transport: 'both', enc: false, use: 'Sets up and tears down a VoIP call. Unencrypted.', secure: '5061 (SIP over TLS)' },
  { port: '5061', proto: 'SIP over TLS', transport: 'both', enc: true, use: 'Encrypted VoIP call signalling.' },
  { port: '5900', proto: 'VNC', transport: 'TCP', enc: false, use: 'Cross-platform graphical remote access. Unlike RDP it has no encryption by default.' },
  { port: '6514', proto: 'Syslog over TLS', transport: 'TCP', enc: true, use: 'Encrypted, acknowledged log shipping.' },
];
