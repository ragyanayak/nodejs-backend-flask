import { useState, useCallback, useRef } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const FIXED_APPROVER = "Kishore Kumar Manne";
const FIXED_REVIEWER = "Kishore Kumar Manne";

const ACTIVITIES = [
  "CPU Increase",
  "CPU Increase With Downtime",
  "CPU Increase With Downtime - DB Services",
  "RAM Increase",
  "RAM Increase With Downtime",
  "Disk Extension",
  "Disk Extension with Downtime",
  "Disk Extension with Downtime - DB services",
  "Shutdown the server",
  "Shutdown the server - DB Services",
  "Reboot the server",
  "Reboot the server - DB Services",
  "IP Swap (VM) with Downtime",
  "IP Swap (VM) with Downtime - DB services",
];

const ROLLBACK_TEMPLATES = {
  "Disk Extension": [
    { task: "Release the disk from server level", implementer: "Unix Team",  duration: "0:10", comments: "No Down Time", required_teams: "Unix Team"  },
    { task: "Remove the disk from infra level",   implementer: "Infra Team", duration: "0:10", comments: "No Down Time", required_teams: "Infra Team" },
  ],
  "Disk Extension with Downtime": [
    { task: "If there is any boot issue on the server, revert the snapshot.", implementer: "Unix Team/KVM/FCRT", duration: "0:40", comments: "Downtime", required_teams: "Unix/KVM/FCRT" },
    { task: "Check all the mount points and services",                         implementer: "Ctrls-Unix",        duration: "0:20", comments: "Downtime", required_teams: "Unix Team"     },
  ],
  "Disk Extension with Downtime - DB services": [
    { task: "If there is any boot issue on the server, revert the snapshot.", implementer: "Unix Team/KVM/FCRT", duration: "0:40", comments: "Downtime", required_teams: "Unix/KVM/FCRT" },
    { task: "Check all the mount points and services",                         implementer: "Ctrls-Unix",        duration: "0:20", comments: "Downtime", required_teams: "Unix Team"     },
  ],
  "IP Swap (VM) with Downtime": [
    { task: "VM - If any issue found disable the NIC and revert the changes", implementer: "CtrlS Unix Team", duration: "0:10", comments: "Downtime", required_teams: "Unix Team"  },
    { task: "VM - If any issue found remove the NIC",                         implementer: "Infra Team",      duration: "0:10", comments: "Downtime", required_teams: "Infra Team" },
    { task: "VM - If still any issue found revert the snapshot",              implementer: "Infra Team",      duration: "0:10", comments: "Downtime", required_teams: "Infra Team" },
  ],
  "IP Swap (VM) with Downtime - DB services": [
    { task: "VM - If any issue found disable the NIC and revert the changes", implementer: "CtrlS Unix Team", duration: "0:10", comments: "Downtime", required_teams: "Unix Team"  },
    { task: "VM - If any issue found remove the NIC",                         implementer: "Infra Team",      duration: "0:10", comments: "Downtime", required_teams: "Infra Team" },
    { task: "VM - If still any issue found revert the snapshot",              implementer: "Infra Team",      duration: "0:10", comments: "Downtime", required_teams: "Infra Team" },
  ],
  "Reboot the server": [
    { task: "If server does not come up, revert the snapshot", implementer: "Unix Team/VDI Team", duration: "0:30", comments: "Downtime", required_teams: "Unix/VDI Team" },
    { task: "Verify all services post rollback",               implementer: "Unix Team",          duration: "0:15", comments: "Downtime", required_teams: "Unix Team"     },
  ],
  "Reboot the server - DB Services": [
    { task: "If server does not come up, revert the snapshot",    implementer: "Unix Team/VDI Team", duration: "0:30", comments: "Downtime", required_teams: "Unix/VDI Team"  },
    { task: "Start the DB Services manually if auto-start fails", implementer: "Oracle DB Team",     duration: "0:15", comments: "Downtime", required_teams: "Oracle DB Team" },
    { task: "Verify all services post rollback",                  implementer: "Unix Team",          duration: "0:15", comments: "Downtime", required_teams: "Unix Team"      },
  ],
  "CPU Increase": [
    { task: "Revert vCPU count to original value", implementer: "VDI Team",  duration: "0:15", comments: "No Down Time", required_teams: "VDI Team"  },
    { task: "Verify CPU count post rollback",       implementer: "Unix Team", duration: "0:10", comments: "No Down Time", required_teams: "Unix Team" },
  ],
  "CPU Increase With Downtime": [
    { task: "Shutdown VM and revert vCPU to original value", implementer: "VDI Team",  duration: "0:20", comments: "Downtime", required_teams: "VDI Team"  },
    { task: "Power on VM and verify CPU count",              implementer: "Unix Team", duration: "0:10", comments: "Downtime", required_teams: "Unix Team" },
  ],
  "CPU Increase With Downtime - DB Services": [
    { task: "Shutdown VM and revert vCPU to original value", implementer: "VDI Team",    duration: "0:20", comments: "Downtime", required_teams: "VDI Team"    },
    { task: "Power on VM and start DB Services",             implementer: "App/DB Team", duration: "0:15", comments: "Downtime", required_teams: "App/DB Team" },
    { task: "Verify CPU count and DB status post rollback",  implementer: "Unix Team",   duration: "0:10", comments: "Downtime", required_teams: "Unix Team"   },
  ],
  "RAM Increase": [
    { task: "Revert RAM to original value", implementer: "VDI Team",  duration: "0:15", comments: "No Down Time", required_teams: "VDI Team"  },
    { task: "Verify RAM post rollback",     implementer: "Unix Team", duration: "0:10", comments: "No Down Time", required_teams: "Unix Team" },
  ],
  "RAM Increase With Downtime": [
    { task: "Shutdown VM and revert RAM to original value", implementer: "VDI Team",  duration: "0:20", comments: "Downtime", required_teams: "VDI Team"  },
    { task: "Power on VM and verify RAM",                   implementer: "Unix Team", duration: "0:10", comments: "Downtime", required_teams: "Unix Team" },
  ],
  "Shutdown the server": [
    { task: "Power on the server if rollback required",     implementer: "Unix Team", duration: "0:10", comments: "Downtime", required_teams: "Unix Team" },
    { task: "Verify server is up and services are running", implementer: "Unix Team", duration: "0:10", comments: "Downtime", required_teams: "Unix Team" },
  ],
  "Shutdown the server - DB Services": [
    { task: "Power on the server",                       implementer: "Unix Team",      duration: "0:10", comments: "Downtime", required_teams: "Unix Team"      },
    { task: "Start DB Services post power-on",           implementer: "Oracle DB Team", duration: "0:15", comments: "Downtime", required_teams: "Oracle DB Team" },
    { task: "Verify server and DB Services are running", implementer: "Unix Team",      duration: "0:10", comments: "Downtime", required_teams: "Unix Team"      },
  ],
};

const ACTIVITY_TEMPLATES = {
  "Disk Extension": {
    pre: [
      { task: "Server Health Checks",                      team: "UNIX TEAM", duration: "0:15" },
      { task: "Server Luns and Mount points screen shots", team: "UNIX TEAM", duration: "0:15" },
      { task: "Server Process and Ports Screen shot",      team: "UNIX TEAM", duration: "0:15" },
    ],
    activity: [
      { task: "Add Disk from infra",    team: "Infra Team", duration: "0:15" },
      { task: "Scan the Disk",          team: "UNIX TEAM",  duration: "0:10" },
      { task: "Create PV",              team: "UNIX TEAM",  duration: "0:10" },
      { task: "Extend VG/LV",           team: "UNIX TEAM",  duration: "0:15" },
      { task: "Resize the Mount point", team: "UNIX TEAM",  duration: "0:10" },
    ],
    post: [{ task: "Check the filesystem status", team: "UNIX TEAM", duration: "0:15" }],
  },
  "Disk Extension with Downtime": {
    pre: [
      { task: "Server Health Checks",                      team: "CS Unix", duration: "0:10" },
      { task: "Server Luns and Mount points screen shots", team: "CS Unix", duration: "0:10" },
      { task: "Server Process and Ports Screen shot",      team: "CS Unix", duration: "0:10" },
      { task: "Suppress the Alerts",                       team: "CS Mon",  duration: "0:10" },
    ],
    activity: [
      { task: "Stop the APP/DB Services",                       team: "APP/DB Team", duration: "0:10" },
      { task: "Take the snapshot of the server",                team: "CS VDI",      duration: "0:10" },
      { task: "Power off the server",                           team: "CS Unix",     duration: "0:10" },
      { task: "Add Disk from infra",                            team: "CS VDI",      duration: "0:10" },
      { task: "Scan the Disk",                                  team: "CS Unix",     duration: "0:10" },
      { task: "Create PV",                                      team: "CS Unix",     duration: "0:10" },
      { task: "Extend VG/LV",                                   team: "CS Unix",     duration: "0:10" },
      { task: "Resize the Mount point and power on the server", team: "CS Unix",     duration: "0:10" },
      { task: "Start the APP/DB Services",                      team: "APP/DB Team", duration: "0:10" },
    ],
    post: [{ task: "Enable the Alerts on the server", team: "CS Mon", duration: "0:15" }],
  },
  "Disk Extension with Downtime - DB services": {
    pre: [
      { task: "Server Health Checks",                      team: "CS Unix", duration: "0:10" },
      { task: "Server Luns and Mount points screen shots", team: "CS Unix", duration: "0:10" },
      { task: "Server Process and Ports Screen shot",      team: "CS Unix", duration: "0:10" },
      { task: "Suppress the Alerts",                       team: "CS Mon",  duration: "0:10" },
    ],
    activity: [
      { task: "Stop the APP Services",                          team: "Client",  duration: "0:10" },
      { task: "Stop the DB Services",                           team: "DB Team", duration: "0:10" },
      { task: "Take the snapshot of the server",                team: "CS VDI",  duration: "0:10" },
      { task: "Power off the server",                           team: "CS Unix", duration: "0:10" },
      { task: "Add Disk from infra",                            team: "CS VDI",  duration: "0:10" },
      { task: "Scan the Disk",                                  team: "CS Unix", duration: "0:10" },
      { task: "Create PV",                                      team: "CS Unix", duration: "0:10" },
      { task: "Extend VG/LV",                                   team: "CS Unix", duration: "0:10" },
      { task: "Resize the Mount point and power on the server", team: "CS Unix", duration: "0:10" },
      { task: "Start the DB Services",                          team: "DB Team", duration: "0:10" },
      { task: "Start the APP Services",                         team: "Client",  duration: "0:10" },
    ],
    post: [{ task: "Enable the Alerts on the server", team: "CS Mon", duration: "0:15" }],
  },
  "IP Swap (VM) with Downtime": {
    pre: [
      { task: "Server Health Checks",               team: "Unix Team",       duration: "0:10" },
      { task: "Check Server Luns and Mount points", team: "Unix Team",       duration: "0:10" },
      { task: "Monitoring team to Suppress alerts", team: "Monitoring Team", duration: "0:10" },
    ],
    activity: [
      { task: "Stop the APP/DB Services",                       team: "Customer",   duration: "0:10" },
      { task: "Take the snapshot of the VM",                    team: "Infra Team", duration: "0:10" },
      { task: "Provide the console",                            team: "Infra Team", duration: "0:05" },
      { task: "From console Swapped the IPs",                   team: "Unix Team",  duration: "0:10" },
      { task: "Tag the respective VLANs",                       team: "Infra Team", duration: "0:05" },
      { task: "Validate the gateway ping status within server", team: "Unix Team",  duration: "0:05" },
      { task: "Check the server access within VPN",             team: "Unix Team",  duration: "0:05" },
      { task: "Start the APP/DB Services",                      team: "Customer",   duration: "0:10" },
    ],
    post: [{ task: "Monitoring team to enable the alerts", team: "Monitoring Team", duration: "0:15" }],
  },
  "IP Swap (VM) with Downtime - DB services": {
    pre: [
      { task: "Server Health Checks",               team: "Unix Team",       duration: "0:10" },
      { task: "Check Server Luns and Mount points", team: "Unix Team",       duration: "0:10" },
      { task: "Monitoring team to Suppress alerts", team: "Monitoring Team", duration: "0:10" },
    ],
    activity: [
      { task: "Stop the APP Services",                          team: "Client",     duration: "0:10" },
      { task: "Stop the DB Services",                           team: "DB Team",    duration: "0:10" },
      { task: "Take the snapshot of the VM",                    team: "Infra Team", duration: "0:10" },
      { task: "Provide the console",                            team: "Infra Team", duration: "0:05" },
      { task: "From console Swapped the IPs",                   team: "Unix Team",  duration: "0:10" },
      { task: "Tag the respective VLANs",                       team: "Infra Team", duration: "0:05" },
      { task: "Validate the gateway ping status within server", team: "Unix Team",  duration: "0:05" },
      { task: "Check the server access within VPN",             team: "Unix Team",  duration: "0:05" },
      { task: "Start the DB Services",                          team: "DB Team",    duration: "0:10" },
      { task: "Start the APP Services",                         team: "Client",     duration: "0:10" },
    ],
    post: [{ task: "Monitoring team to enable the alerts", team: "Monitoring Team", duration: "0:15" }],
  },
  "Reboot the server": {
    pre: [
      { task: "Need to take the server level outputs", team: "Unix Team", duration: "0:15" },
      { task: "Suppress alerts on the server",         team: "Mon Team",  duration: "0:15" },
      { task: "Take the snapshot of the server",       team: "VDI Team",  duration: "0:30" },
    ],
    activity: [
      { task: "Reboot the server", team: "Unix Team", duration: "0:20" },
    ],
    post: [
      { task: "Check the Server Status from Putty", team: "Unix Team", duration: "0:30" },
    ],
  },
  "Reboot the server - DB Services": {
    pre: [
      { task: "Need to take the server level outputs", team: "Unix Team", duration: "0:15" },
      { task: "Suppress alerts on the server",         team: "Mon Team",  duration: "0:15" },
      { task: "Take the snapshot of the server",       team: "VDI Team",  duration: "0:30" },
    ],
    activity: [
      { task: "Stop the DB Services",            team: "Oracle DB Team", duration: "0:15" },
      { task: "Enable the Kdump on the servers", team: "Unix Team",      duration: "0:20" },
      { task: "Reboot the server",               team: "Unix Team",      duration: "0:20" },
      { task: "Start the DB services",           team: "App/DB Team",    duration: "0:15" },
    ],
    post: [
      { task: "Check the Server Status from Putty", team: "Unix Team", duration: "0:30" },
      { task: "Monitor the DB Services Status",     team: "DB Team",   duration: "0:30" },
    ],
  },
  "CPU Increase": {
    pre:      [{ task: "Capture current CPU metrics",  team: "Unix Team", duration: "0:10" }],
    activity: [{ task: "Increase vCPU on VM",          team: "VDI Team",  duration: "0:15" }],
    post:     [{ task: "Verify CPU count post change", team: "Unix Team", duration: "0:10" }],
  },
  "CPU Increase With Downtime": {
    pre: [{ task: "Capture current CPU metrics", team: "Unix Team", duration: "0:10" }],
    activity: [
      { task: "Shutdown and increase vCPU", team: "VDI Team", duration: "0:20" },
      { task: "Power on the VM",            team: "VDI Team", duration: "0:10" },
    ],
    post: [{ task: "Verify CPU count post change", team: "Unix Team", duration: "0:10" }],
  },
  "CPU Increase With Downtime - DB Services": {
    pre: [{ task: "Capture current CPU metrics", team: "Unix Team", duration: "0:10" }],
    activity: [
      { task: "Stop DB Services",           team: "Oracle DB Team", duration: "0:15" },
      { task: "Shutdown and increase vCPU", team: "VDI Team",       duration: "0:20" },
      { task: "Power on the VM",            team: "VDI Team",       duration: "0:10" },
      { task: "Start DB Services",          team: "App/DB Team",    duration: "0:15" },
    ],
    post: [{ task: "Verify CPU and DB status", team: "Unix Team", duration: "0:15" }],
  },
  "RAM Increase": {
    pre:      [{ task: "Capture current RAM metrics", team: "Unix Team", duration: "0:10" }],
    activity: [{ task: "Increase RAM on VM",          team: "VDI Team",  duration: "0:15" }],
    post:     [{ task: "Verify RAM post change",      team: "Unix Team", duration: "0:10" }],
  },
  "RAM Increase With Downtime": {
    pre: [{ task: "Capture current RAM metrics", team: "Unix Team", duration: "0:10" }],
    activity: [
      { task: "Shutdown and increase RAM", team: "VDI Team", duration: "0:20" },
      { task: "Power on the VM",           team: "VDI Team", duration: "0:10" },
    ],
    post: [{ task: "Verify RAM post change", team: "Unix Team", duration: "0:10" }],
  },
  "Shutdown the server": {
    pre:      [{ task: "Notify stakeholders of shutdown", team: "Unix Team", duration: "0:10" }],
    activity: [{ task: "Gracefully shutdown the server",  team: "Unix Team", duration: "0:15" }],
    post:     [{ task: "Confirm server is powered off",   team: "Unix Team", duration: "0:10" }],
  },
  "Shutdown the server - DB Services": {
    pre: [{ task: "Notify stakeholders of shutdown", team: "Unix Team", duration: "0:10" }],
    activity: [
      { task: "Stop DB Services",               team: "Oracle DB Team", duration: "0:15" },
      { task: "Gracefully shutdown the server", team: "Unix Team",      duration: "0:15" },
    ],
    post: [{ task: "Confirm server is powered off", team: "Unix Team", duration: "0:10" }],
  },
};

const DEFAULT_ROLLBACK = [
  { task: "Revert to previous configuration if any issue found", implementer: "Unix Team", duration: "0:15", comments: "Downtime", required_teams: "Unix Team" },
];

const STEPS    = ["POA Details", "Server Details", "People & Roles", "Preview & Export"];
const API_BASE = "http://localhost:5000";

const defaultEscalationRows = [
  { resource: "Unix Team", executor: "UNIX Ent", escalation: "Shift Engineer", contact: "7207934019", oncall: "On Site" },
  { resource: "Unix Team", executor: "UNIX Ent", escalation: "Linux",          contact: "7207934019", oncall: "On Site" },
  { resource: "Unix Team", executor: "UNIX Ent", escalation: "inumpudi",       contact: "7207934019", oncall: "On Site" },
];

const defaultForm = {
  client_name: "", cr_date: "", client_spoc: "", client_mail: "",
  cr_id: "", start_datetime: "", end_datetime: "", duration: "",
  client_mobile: "", activity_start_date: "", activity_end_date: "",
  infra_team: "", infra_mail: "", pm_name: "", pm_mail: "", pm_mobile: "",
  risk: "", activity: "Disk Extension with Downtime - DB services",
  rollback_reviewer: "Linux",
  rollback_responsible: "Linux",
  approver_fixed: FIXED_APPROVER, approver_extra: "",
  change_performer: "",
  post_review_fixed: FIXED_REVIEWER, post_review_extra: "",
  comm_name: "", comm_phone: "", comm_email: "",
  comm_client_impact: "", comm_teams_notify: "",
  escalation_rows: defaultEscalationRows.map(r => ({ ...r })),
};

const defaultServer = { env: "", db_name: "", ip: "", kdump: "" };
let nextId = 2;

// ── FIX: Duration calculated from Change Start → Change End ──────────────────
function calcDuration(start, end) {
  if (!start || !end) return "";
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) return "";
  const diff = e - s;
  if (diff <= 0) return ""; // end must be after start
  const t = Math.floor(diff / 60000);
  const d = Math.floor(t / 1440);
  const h = Math.floor((t % 1440) / 60);
  const m = t % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.length ? parts.join(" ") : "0m";
}

// Returns true if end_datetime < start_datetime (invalid window)
function isInvalidWindow(start, end) {
  if (!start || !end) return false;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) return false;
  return e <= s;
}

function mkPoa(label) {
  const id = nextId++;
  return {
    id,
    label: label || `POA #${id}`,
    form: { ...defaultForm, escalation_rows: defaultForm.escalation_rows.map(r => ({ ...r })) },
    servers: [{ ...defaultServer }],
    step: 0,
  };
}

// ── Icon components ───────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    plus:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    copy:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    edit:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    lock:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    file:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    server: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
    users:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    eye:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    chevron: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    alert: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    warn:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  };
  return icons[name] || null;
};

// ── Shared UI components ──────────────────────────────────────────────────────
function Field({ label, name, value, onChange, type = "text", required, readOnly, badge, placeholder, className = "" }) {
  return (
    <div className={`field ${className}`}>
      <label className="field-label">
        {label}
        {required && <span className="field-required">*</span>}
        {badge && <span className="field-badge">{badge}</span>}
      </label>
      <input
        className={`field-input${readOnly ? " field-input--auto" : ""}`}
        type={type} name={name} value={value}
        onChange={onChange} autoComplete="off" readOnly={readOnly}
        placeholder={placeholder || (readOnly ? "Auto-calculated" : "")}
      />
    </div>
  );
}

function Textarea({ label, name, value, onChange, rows = 3 }) {
  return (
    <div className="field field--full">
      <label className="field-label">{label}</label>
      <textarea className="field-input field-textarea" name={name} value={value} onChange={onChange} rows={rows} />
    </div>
  );
}

function Select({ label, name, value, onChange, options }) {
  return (
    <div className="field field--full">
      <label className="field-label">{label}</label>
      <select className="field-input field-select" name={name} value={value} onChange={onChange}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SectionLabel({ children, icon }) {
  return (
    <div className="section-label">
      {icon && <span className="section-label-icon">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function LockedPlusExtra({ label, fixedValue, extraName, extraValue, onChange }) {
  return (
    <div className="field field--full">
      <label className="field-label">{label}</label>
      <div className="locked-plus-extra">
        <div className="locked-chip">
          <Icon name="lock" size={12} />
          <span>{fixedValue}</span>
          <span className="locked-tag">fixed</span>
        </div>
        <input
          className="field-input locked-extra"
          type="text"
          name={extraName}
          value={extraValue}
          onChange={onChange}
          placeholder="Add another person (optional)"
        />
      </div>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ steps, current }) {
  return (
    <div className="step-track">
      {steps.map((label, i) => (
        <div key={i} className={`step-item${i === current ? " step-item--active" : i < current ? " step-item--done" : ""}`}>
          <div className="step-node">
            {i < current ? <Icon name="check" size={12} /> : <span>{i + 1}</span>}
          </div>
          <span className="step-name">{label}</span>
          {i < steps.length - 1 && <div className="step-connector" />}
        </div>
      ))}
    </div>
  );
}

// ── Preview components ────────────────────────────────────────────────────────
function PreviewBlock({ title, accent = "var(--c-primary)", children }) {
  return (
    <div className="preview-block">
      <div className="preview-block-header" style={{ borderLeftColor: accent }}>
        <span className="preview-block-title">{title}</span>
      </div>
      <div className="preview-block-body">{children}</div>
    </div>
  );
}

function PreviewRow({ label, value, editMode, fieldName, onEdit, type = "text" }) {
  const [editing, setEditing] = useState(false);
  const go   = () => { if (editMode) setEditing(true); };
  const done = e  => { onEdit?.(fieldName, e.target.value); setEditing(false); };
  const key  = e  => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(false); };
  return (
    <div className={`pv-row${editMode ? " pv-row--edit" : ""}`} onClick={go}>
      <span className="pv-key">{label}</span>
      {editing
        ? <input className="pv-edit-input" type={type} defaultValue={value} autoFocus
            onBlur={done} onKeyDown={key} onClick={e => e.stopPropagation()} />
        : <span className="pv-val">
            {value || <em className="pv-empty">—</em>}
            {editMode && <span className="pv-edit-icon"><Icon name="edit" size={12} /></span>}
          </span>}
    </div>
  );
}

function ActivityPlanTable({ activity }) {
  const tmpl = ACTIVITY_TEMPLATES[activity];
  if (!tmpl) return <p className="no-data">No template for this activity type.</p>;

  const PhaseRows = ({ title, phase, rows }) => {
    const phaseClass = { pre: "phase-pre", activity: "phase-act", post: "phase-post" }[phase];
    return (
      <>
        <tr className={`phase-header ${phaseClass}`}>
          <td colSpan={4}>{title}</td>
        </tr>
        {rows.map((r, i) => (
          <tr key={i} className="data-row">
            <td className="td-num">{i + 1}</td>
            <td className="td-task">{r.task}</td>
            <td><span className="team-chip">{r.team}</span></td>
            <td><span className="dur-chip">{r.duration}</span></td>
          </tr>
        ))}
      </>
    );
  };

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr><th>#</th><th>Task</th><th>Owner / Team</th><th>Duration</th></tr>
        </thead>
        <tbody>
          <PhaseRows title="Pre-Activity"  phase="pre"      rows={tmpl.pre}      />
          <PhaseRows title="Activity"      phase="activity" rows={tmpl.activity} />
          <PhaseRows title="Post-Activity" phase="post"     rows={tmpl.post}     />
        </tbody>
      </table>
    </div>
  );
}

function RollbackTable({ activity, plannedDate }) {
  const steps = ROLLBACK_TEMPLATES[activity] || DEFAULT_ROLLBACK;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {["#","Planned Date","Duration","Implementer","Activity / Step Details","Required Teams","Comments"].map(h => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i} className="data-row">
              <td className="td-num">{i + 1}</td>
              <td className="td-mono">{plannedDate || "TBD"}</td>
              <td><span className="dur-chip">{s.duration}</span></td>
              <td>{s.implementer}</td>
              <td className="td-task">{s.task}</td>
              <td>{s.required_teams}</td>
              <td><span className={`status-chip ${s.comments === "Downtime" ? "status-down" : "status-ok"}`}>{s.comments}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [poas, setPoas]             = useState([{
    id: 1, label: "POA #1",
    form: { ...defaultForm, escalation_rows: defaultForm.escalation_rows.map(r => ({ ...r })) },
    servers: [{ ...defaultServer }],
    step: 0,
  }]);
  const [activeId, setActiveId]     = useState(1);
  const [loading, setLoading]       = useState(null);
  const [toast, setToast]           = useState(null);
  const [editMode, setEditMode]     = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const renameRef = useRef(null);

  const active = poas.find(p => p.id === activeId);
  const { form, servers, step } = active;

  const patch = useCallback(diff => {
    setPoas(prev => prev.map(p => p.id === activeId ? { ...p, ...diff } : p));
  }, [activeId]);

  // ── FIX: Duration auto-calculated from Change Start → Change End ─────────
  const handleChange = useCallback(e => {
    const { name, value } = e.target;
    const f = { ...active.form, [name]: value };
    if (name === "start_datetime" || name === "end_datetime") {
      const s = name === "start_datetime" ? value : active.form.start_datetime;
      const n = name === "end_datetime"   ? value : active.form.end_datetime;
      f.duration = calcDuration(s, n);
      // activity_start_date comes from the date part of Change Start
      if (name === "start_datetime") f.activity_start_date = value.split("T")[0];
      // activity_end_date comes from the date part of Change End
      if (name === "end_datetime")   f.activity_end_date   = value.split("T")[0];
    }
    patch({ form: f });
  }, [active, patch]);

  const editField = (name, value) => {
    const f = { ...active.form, [name]: value };
    if (name === "start_datetime" || name === "end_datetime") {
      const s = name === "start_datetime" ? value : active.form.start_datetime;
      const n = name === "end_datetime"   ? value : active.form.end_datetime;
      f.duration = calcDuration(s, n);
      if (name === "start_datetime") f.activity_start_date = value.split("T")[0];
      if (name === "end_datetime")   f.activity_end_date   = value.split("T")[0];
    }
    patch({ form: f });
  };

  const editEscRow    = (i, field, val) => {
    const rows = active.form.escalation_rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    patch({ form: { ...active.form, escalation_rows: rows } });
  };
  const addEscRow    = () => patch({ form: { ...active.form, escalation_rows: [...active.form.escalation_rows, { resource: "", executor: "", escalation: "", contact: "", oncall: "" }] } });
  const removeEscRow = i  => patch({ form: { ...active.form, escalation_rows: active.form.escalation_rows.filter((_, idx) => idx !== i) } });

  const addPoa    = () => { const p = mkPoa(); setPoas(prev => [...prev, p]); setActiveId(p.id); setEditMode(false); };
  const delPoa    = id => { if (poas.length === 1) return; const rest = poas.filter(p => p.id !== id); setPoas(rest); if (activeId === id) setActiveId(rest[0].id); };
  const dupPoa    = id => { const src = poas.find(p => p.id === id); const copy = { ...JSON.parse(JSON.stringify(src)), id: nextId++, label: `${src.label} (Copy)`, step: 0 }; setPoas(prev => [...prev, copy]); setActiveId(copy.id); };
  const renamePoa = (id, label) => { setPoas(prev => prev.map(p => p.id === id ? { ...p, label: label || p.label } : p)); setRenamingId(null); };

  const setStep      = s => patch({ step: s });
  const addServer    = ()         => patch({ servers: [...servers, { ...defaultServer }] });
  const removeServer = i          => patch({ servers: servers.filter((_, idx) => idx !== i) });
  const editServer   = (i, f, v) => patch({ servers: servers.map((s, idx) => idx === i ? { ...s, [f]: v } : s) });

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const payload = { ...form, servers };

  const exportExcel = async () => {
    setLoading("xlsx");
    try {
      const res = await fetch(`${API_BASE}/generate-excel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Server error"); }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = `POA_${form.cr_id || "output"}.xlsx`; a.click(); URL.revokeObjectURL(url);
      notify("Excel exported successfully!");
    } catch (e) { notify(e.message || "Export failed. Is Flask running?", "error"); }
    setLoading(null);
  };

  const exportCSV = async () => {
    setLoading("csv");
    try {
      const res = await fetch(`${API_BASE}/generate-csv`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Server error");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = `POA_${form.cr_id || "output"}.csv`; a.click(); URL.revokeObjectURL(url);
      notify("CSV exported successfully!");
    } catch { notify("CSV export failed. Is Flask running?", "error"); }
    setLoading(null);
  };

  // Detect invalid change window for UI warning
  const windowInvalid = isInvalidWindow(form.start_datetime, form.end_datetime);

  return (
    <div className="layout">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sb-brand">
          <div className="sb-logo"><span>P</span></div>
          <div className="sb-brand-text">
            <div className="sb-title">POA Dashboard</div>
            <div className="sb-sub">CtrlS Infrastructure</div>
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-section-header">
            <span className="sb-section-label">Documents</span>
            <button className="sb-icon-btn" onClick={addPoa} title="New POA">
              <Icon name="plus" size={14} />
            </button>
          </div>
          <div className="sb-poa-list">
            {poas.map(poa => (
              <div key={poa.id} className={`sb-poa-item${poa.id === activeId ? " sb-poa-item--active" : ""}`}>
                {renamingId === poa.id ? (
                  <input
                    ref={renameRef}
                    className="sb-rename-input"
                    defaultValue={poa.label}
                    autoFocus
                    onBlur={e => renamePoa(poa.id, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") renamePoa(poa.id, e.target.value); if (e.key === "Escape") setRenamingId(null); }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="sb-poa-name"
                    onClick={() => { setActiveId(poa.id); setEditMode(false); }}
                    onDoubleClick={() => setRenamingId(poa.id)}
                    title="Double-click to rename"
                  >
                    <Icon name="file" size={13} />
                    {poa.label}
                  </span>
                )}
                <div className="sb-poa-actions">
                  <button className="sb-poa-btn" title="Duplicate" onClick={e => { e.stopPropagation(); dupPoa(poa.id); }}>
                    <Icon name="copy" size={12} />
                  </button>
                  {poas.length > 1 && (
                    <button className="sb-poa-btn sb-poa-btn--del" title="Delete" onClick={e => { e.stopPropagation(); delPoa(poa.id); }}>
                      <Icon name="trash" size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sb-section sb-steps">
          <div className="sb-section-label" style={{ marginBottom: 12 }}>Progress</div>
          {STEPS.map((s, i) => (
            <div key={s} className={`sb-step${step === i ? " sb-step--active" : step > i ? " sb-step--done" : ""}`}>
              <div className="sb-step-node">
                {step > i ? <Icon name="check" size={11} /> : <span>{i + 1}</span>}
              </div>
              <span className="sb-step-label">{s}</span>
            </div>
          ))}
        </div>

        {(form.cr_id || form.client_name || form.activity) && (
          <div className="sb-meta">
            {form.activity && (
              <div className="sb-meta-item">
                <span className="sb-meta-dot" />
                <span>{form.activity}</span>
              </div>
            )}
            {form.cr_id && <div className="sb-meta-cr">CR: {form.cr_id}</div>}
            {form.client_name && <div className="sb-meta-client">{form.client_name}</div>}
          </div>
        )}
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="main">

        <header className="main-header">
          <div className="main-header-left">
            <h1 className="main-title">{STEPS[step]}</h1>
            <p className="main-subtitle">
              {step === 0 && "Enter the change request details and activity configuration"}
              {step === 1 && "Register all servers included in this change activity"}
              {step === 2 && "Configure personnel, communications and escalation matrix"}
              {step === 3 && "Review your POA document and export in your preferred format"}
            </p>
          </div>
          <div className="main-header-right">
            {step === 3 && (
              <button
                className={`btn-edit-toggle${editMode ? " btn-edit-toggle--on" : ""}`}
                onClick={() => setEditMode(v => !v)}
              >
                <Icon name={editMode ? "check" : "edit"} size={14} />
                {editMode ? "Done" : "Edit Preview"}
              </button>
            )}
            <div className="step-pill">{step + 1} / {STEPS.length}</div>
          </div>
        </header>

        <div className="step-tracker-bar">
          <StepIndicator steps={STEPS} current={step} />
        </div>

        <div className="main-content">

          {/* STEP 0 — POA Details */}
          {step === 0 && (
            <div className="form-area animate-in">
              <Card>
                <SectionLabel icon="👤">Client Information</SectionLabel>
                <div className="form-grid">
                  <Field label="Client Name"   name="client_name"   value={form.client_name}   onChange={handleChange} required />
                  <Field label="CR ID"         name="cr_id"         value={form.cr_id}         onChange={handleChange} required />
                  <Field label="CR Date"       name="cr_date"       value={form.cr_date}       onChange={handleChange} type="date" />
                  <Field label="Client SPOC"   name="client_spoc"   value={form.client_spoc}   onChange={handleChange} />
                  <Field label="Client Email"  name="client_mail"   value={form.client_mail}   onChange={handleChange} type="email" className="field--span2" />
                  <Field label="Client Mobile" name="client_mobile" value={form.client_mobile} onChange={handleChange} />
                </div>
              </Card>

              <Card>
                <SectionLabel icon="🗓️">Change Window</SectionLabel>
                {/* ── FIX: Warning when Change End is before or equal to Change Start ── */}
                {windowInvalid && (
                  <div className="window-warning">
                    <Icon name="warn" size={15} />
                    <span>
                      <strong>Change End</strong> must be after <strong>Change Start</strong>.
                      If the window crosses midnight, set the correct date on the end field
                      (e.g. start&nbsp;2026-04-15&nbsp;22:55 → end&nbsp;<strong>2026-04-16</strong>&nbsp;02:59).
                      Duration will remain blank until corrected.
                    </span>
                  </div>
                )}
                <div className="form-grid">
                  <Field label="Change Start Date & Time" name="start_datetime"      value={form.start_datetime}      onChange={handleChange} type="datetime-local" />
                  <Field label="Change End Date & Time"   name="end_datetime"        value={form.end_datetime}        onChange={handleChange} type="datetime-local" />
                  {/* Duration auto-calculated from Change Start → Change End */}
                  <Field label="Duration (auto)"         name="duration"            value={form.duration}            onChange={handleChange} readOnly badge="auto" />
                  <Field label="Activity Start Date"     name="activity_start_date" value={form.activity_start_date} onChange={handleChange} readOnly badge="auto" />
                  <Field label="Activity End Date"       name="activity_end_date"   value={form.activity_end_date}   onChange={handleChange} readOnly badge="auto" />
                </div>
              </Card>

              <Card>
                <SectionLabel icon="🏢">Infrastructure & PM</SectionLabel>
                <div className="form-grid">
                  <Field label="Infra Team"  name="infra_team" value={form.infra_team} onChange={handleChange} />
                  <Field label="Infra Email" name="infra_mail" value={form.infra_mail} onChange={handleChange} type="email" />
                  <Field label="PM Name"     name="pm_name"    value={form.pm_name}    onChange={handleChange} />
                  <Field label="PM Email"    name="pm_mail"    value={form.pm_mail}    onChange={handleChange} type="email" />
                  <Field label="PM Mobile"   name="pm_mobile"  value={form.pm_mobile}  onChange={handleChange} />
                </div>
              </Card>

              <Card>
                <SectionLabel icon="⚙️">Activity & Risk</SectionLabel>
                <div className="form-grid">
                  <Select label="Activity Type" name="activity" value={form.activity} onChange={handleChange} options={ACTIVITIES} />
                  <Textarea label="Risk & Impact Analysis" name="risk" value={form.risk} onChange={handleChange} rows={4} />
                </div>
              </Card>
            </div>
          )}

          {/* STEP 1 — Server Details */}
          {step === 1 && (
            <div className="form-area animate-in">
              {servers.map((srv, i) => (
                <Card key={i}>
                  <div className="server-header">
                    <div className="server-title">
                      <Icon name="server" size={16} />
                      <span>Server #{i + 1}</span>
                    </div>
                    {servers.length > 1 && (
                      <button className="btn-remove" onClick={() => removeServer(i)}>
                        <Icon name="trash" size={13} /> Remove
                      </button>
                    )}
                  </div>
                  <div className="form-grid">
                    {[["Environment","env"],["Database Name","db_name"],["IP Address","ip"],["Kdump Status","kdump"]].map(([lbl, fld]) => (
                      <div key={fld} className="field">
                        <label className="field-label">{lbl}</label>
                        <input className="field-input" value={srv[fld]} onChange={e => editServer(i, fld, e.target.value)} placeholder={lbl} />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
              <button className="btn-add-more" onClick={addServer}>
                <Icon name="plus" size={15} /> Add Another Server
              </button>
            </div>
          )}

          {/* STEP 2 — People & Roles */}
          {step === 2 && (
            <div className="form-area animate-in">

              <Card>
                <SectionLabel icon="↩️">Rollback Plan Roles</SectionLabel>
                <div className="form-grid">
                  <Field label="Rollback Reviewer"                   name="rollback_reviewer"   value={form.rollback_reviewer}   onChange={handleChange} />
                  <Field label="Rollback Responsibility/Accountable" name="rollback_responsible" value={form.rollback_responsible} onChange={handleChange} />
                </div>
              </Card>

              <Card>
                <SectionLabel icon="✅">Approver / Reviewer</SectionLabel>
                <LockedPlusExtra
                  label="Approver / Reviewer"
                  fixedValue={form.approver_fixed}
                  extraName="approver_extra"
                  extraValue={form.approver_extra}
                  onChange={handleChange}
                />
              </Card>

              <Card>
                <SectionLabel icon="🛠️">Change Performer</SectionLabel>
                <div className="form-grid">
                  <Field label="Change Performer" name="change_performer" value={form.change_performer} onChange={handleChange} />
                </div>
              </Card>

              <Card>
                <SectionLabel icon="🔍">Change Review — Post Activity</SectionLabel>
                <LockedPlusExtra
                  label="Post Activity Reviewer"
                  fixedValue={form.post_review_fixed}
                  extraName="post_review_extra"
                  extraValue={form.post_review_extra}
                  onChange={handleChange}
                />
              </Card>

              <Card>
                <SectionLabel icon="📡">Communication Plan</SectionLabel>
                {/* Shows the Change Window summary from Step 0 */}
                <div className="comm-readonly">
                  <div className="comm-readonly-item">
                    <span className="comm-key">Change Start</span>
                    <span className="comm-val">{form.start_datetime ? form.start_datetime.replace("T", " ") : "—"}</span>
                  </div>
                  <div className="comm-readonly-item">
                    <span className="comm-key">Change End</span>
                    <span className="comm-val">{form.end_datetime ? form.end_datetime.replace("T", " ") : "—"}</span>
                  </div>
                  <div className="comm-readonly-item">
                    <span className="comm-key">Duration</span>
                    <span className={`comm-val comm-dur${windowInvalid ? " comm-dur--warn" : ""}`}>
                      {windowInvalid ? "⚠ Invalid window" : (form.duration || "—")}
                    </span>
                  </div>
                </div>
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <Field label="Name"                     name="comm_name"          value={form.comm_name}          onChange={handleChange} />
                  <Field label="Phone"                    name="comm_phone"         value={form.comm_phone}         onChange={handleChange} />
                  <Field label="Email"                    name="comm_email"         value={form.comm_email}         onChange={handleChange} type="email" />
                  <Field label="Client Impact"            name="comm_client_impact" value={form.comm_client_impact} onChange={handleChange} />
                  <Field label="Teams / Person to Notify" name="comm_teams_notify"  value={form.comm_teams_notify}  onChange={handleChange} className="field--span2" />
                </div>
              </Card>

              <Card>
                <SectionLabel icon="🚨">Ctrls Escalation Matrix</SectionLabel>
                <div className="table-wrap">
                  <table className="data-table esc-table">
                    <thead>
                      <tr>
                        {["Resource Summary","Executor","Escalation","Contact Details","On Site / Call",""].map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {form.escalation_rows.map((row, i) => (
                        <tr key={i} className="data-row">
                          {[["resource","Resource"],["executor","Executor"],["escalation","Escalation"],["contact","Contact"],["oncall","On Site/Call"]].map(([f, ph]) => (
                            <td key={f}>
                              <input className="esc-input" value={row[f]} onChange={e => editEscRow(i, f, e.target.value)} placeholder={ph} />
                            </td>
                          ))}
                          <td>
                            {form.escalation_rows.length > 1 && (
                              <button className="esc-del-btn" onClick={() => removeEscRow(i)}>
                                <Icon name="trash" size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn-add-row" onClick={addEscRow}>
                  <Icon name="plus" size={14} /> Add Row
                </button>
              </Card>
            </div>
          )}

          {/* STEP 3 — Preview & Export */}
          {step === 3 && (
            <div className="form-area animate-in">
              {editMode && (
                <div className="edit-banner">
                  <Icon name="edit" size={14} />
                  <strong>Edit Mode</strong> — Click any value to edit it inline.
                </div>
              )}

              {/* Warn about invalid window in preview too */}
              {windowInvalid && (
                <div className="window-warning">
                  <Icon name="warn" size={15} />
                  <span><strong>Duration of Change</strong> will be blank in the exported file — Change End is before or equal to Change Start. Fix the dates in Step 1.</span>
                </div>
              )}

              <PreviewBlock title="Change Request Details" accent="var(--c-primary)">
                <div className="pv-grid">
                  <PreviewRow label="Client Name"         value={form.client_name}    editMode={editMode} fieldName="client_name"    onEdit={editField} />
                  <PreviewRow label="CR ID"               value={form.cr_id}          editMode={editMode} fieldName="cr_id"          onEdit={editField} />
                  <PreviewRow label="CR Date"             value={form.cr_date}        editMode={editMode} fieldName="cr_date"        onEdit={editField} type="date" />
                  <PreviewRow label="Client SPOC"         value={form.client_spoc}    editMode={editMode} fieldName="client_spoc"    onEdit={editField} />
                  <PreviewRow label="Client Email"        value={form.client_mail}    editMode={editMode} fieldName="client_mail"    onEdit={editField} type="email" />
                  <PreviewRow label="Client Mobile"       value={form.client_mobile}  editMode={editMode} fieldName="client_mobile"  onEdit={editField} />
                  {/* FIX: Display datetimes without the "T" separator */}
                  <PreviewRow label="Change Start"        value={form.start_datetime ? form.start_datetime.replace("T", " ") : ""} editMode={false} />
                  <PreviewRow label="Change End"          value={form.end_datetime   ? form.end_datetime.replace("T",   " ") : ""} editMode={false} />
                  <PreviewRow label="Duration of Change"  value={form.duration}       editMode={false} />
                  <PreviewRow label="Activity"            value={form.activity}       editMode={false} />
                  <PreviewRow label="Activity Start Date" value={form.activity_start_date} editMode={false} />
                  <PreviewRow label="Activity End Date"   value={form.activity_end_date}   editMode={false} />
                </div>
              </PreviewBlock>

              <PreviewBlock title="Infrastructure & PM" accent="#2563eb">
                <div className="pv-grid">
                  <PreviewRow label="Infra Team"  value={form.infra_team} editMode={editMode} fieldName="infra_team" onEdit={editField} />
                  <PreviewRow label="Infra Email" value={form.infra_mail} editMode={editMode} fieldName="infra_mail" onEdit={editField} type="email" />
                  <PreviewRow label="PM Name"     value={form.pm_name}    editMode={editMode} fieldName="pm_name"    onEdit={editField} />
                  <PreviewRow label="PM Email"    value={form.pm_mail}    editMode={editMode} fieldName="pm_mail"    onEdit={editField} type="email" />
                  <PreviewRow label="PM Mobile"   value={form.pm_mobile}  editMode={editMode} fieldName="pm_mobile"  onEdit={editField} />
                </div>
              </PreviewBlock>

              <PreviewBlock title="Risk & Impact" accent="#dc2626">
                {editMode
                  ? <textarea className="field-input field-textarea" value={form.risk} onChange={e => editField("risk", e.target.value)} rows={3} />
                  : <p className="risk-para">{form.risk || <em className="pv-empty">No risk analysis provided</em>}</p>}
              </PreviewBlock>

              <PreviewBlock title="People & Roles" accent="#7c3aed">
                <div className="pv-grid">
                  <PreviewRow label="Rollback Reviewer"    value={form.rollback_reviewer}    editMode={editMode} fieldName="rollback_reviewer"    onEdit={editField} />
                  <PreviewRow label="Rollback Responsible" value={form.rollback_responsible} editMode={editMode} fieldName="rollback_responsible" onEdit={editField} />
                  <PreviewRow label="Change Performer"     value={form.change_performer}     editMode={editMode} fieldName="change_performer"     onEdit={editField} />
                </div>
                <div className="locked-preview-row">
                  <span className="pv-key">Approver / Reviewer</span>
                  <div className="locked-chips">
                    <span className="lc-fixed"><Icon name="lock" size={11} /> {form.approver_fixed}</span>
                    {form.approver_extra && <span className="lc-extra">+ {form.approver_extra}</span>}
                  </div>
                </div>
                <div className="locked-preview-row">
                  <span className="pv-key">Post Activity Review</span>
                  <div className="locked-chips">
                    <span className="lc-fixed"><Icon name="lock" size={11} /> {form.post_review_fixed}</span>
                    {form.post_review_extra && <span className="lc-extra">+ {form.post_review_extra}</span>}
                  </div>
                </div>
              </PreviewBlock>

              <PreviewBlock title="Communication Plan" accent="#059669">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>{["Change Start","Change End","Duration","Name","Phone","Email","Client Impact","Teams / Person"].map(h => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      <tr className="data-row">
                        {/* FIX: Show datetimes without "T" */}
                        <td className="td-mono">{form.start_datetime ? form.start_datetime.replace("T", " ") : "—"}</td>
                        <td className="td-mono">{form.end_datetime   ? form.end_datetime.replace("T",   " ") : "—"}</td>
                        <td><span className="dur-chip">{form.duration || "—"}</span></td>
                        <td>{form.comm_name          || "—"}</td>
                        <td>{form.comm_phone         || "—"}</td>
                        <td>{form.comm_email         || "—"}</td>
                        <td>{form.comm_client_impact || "—"}</td>
                        <td>{form.comm_teams_notify  || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </PreviewBlock>

              <PreviewBlock title="Ctrls Escalation Matrix" accent="#b45309">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>{["Resource Summary","Executor","Escalation","Contact Details","On Site / Call"].map(h => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {form.escalation_rows.map((r, i) => (
                        <tr key={i} className="data-row">
                          <td>{r.resource || "—"}</td><td>{r.executor || "—"}</td>
                          <td>{r.escalation || "—"}</td><td>{r.contact || "—"}</td><td>{r.oncall || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PreviewBlock>

              <PreviewBlock title="Server Details" accent="#0284c7">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>{["#","Environment","DB Name","IP Address","Kdump"].map(h => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {servers.map((s, i) => (
                        <tr key={i} className="data-row">
                          <td className="td-num">{i + 1}</td>
                          {editMode ? (
                            ["env","db_name","ip","kdump"].map(f =>
                              <td key={f}><input className="esc-input" value={s[f]} onChange={e => editServer(i, f, e.target.value)} placeholder="—" /></td>)
                          ) : (
                            <>
                              <td>{s.env     || "—"}</td>
                              <td>{s.db_name || "—"}</td>
                              <td className="td-mono">{s.ip || "—"}</td>
                              <td><span className={`status-chip ${s.kdump ? "status-ok" : ""}`}>{s.kdump || "—"}</span></td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PreviewBlock>

              <PreviewBlock title="Activity Plan" accent="#10b981">
                <div className="activity-meta">
                  <span className="activity-tag">{form.activity || "No activity selected"}</span>
                </div>
                <ActivityPlanTable activity={form.activity} />
              </PreviewBlock>

              {/* FIX: Rollback table header now matches correct column order */}
              <PreviewBlock title="Rollback Plan" accent="#8b5cf6">
                <div className="activity-meta">
                  <span className="activity-tag">{form.activity || "No activity selected"}</span>
                  <span className="step-count">{(ROLLBACK_TEMPLATES[form.activity] || DEFAULT_ROLLBACK).length} step(s)</span>
                </div>
                <RollbackTable activity={form.activity} plannedDate={form.activity_start_date} />
              </PreviewBlock>

              {/* Export panel */}
              <div className="export-panel">
                <div className="export-panel-left">
                  <div className="export-title">Export POA Document</div>
                  <p className="export-desc">
                    All data is injected into <strong>POA_Template.XLSX</strong>, preserving formatting, merged cells, and cross-sheet formulas.
                  </p>
                  <div className="sheet-chips">
                    {["Header","Activity Plan","Rollback Plan","Server Details","Communication Plan","Escalation Matrix","Post-Validation"].map(s => (
                      <span key={s} className="sheet-chip">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="export-btns">
                  <button className="btn-export btn-export--xlsx" onClick={exportExcel} disabled={!!loading}>
                    {loading === "xlsx" ? <span className="spinner" /> : <Icon name="download" size={16} />}
                    {loading === "xlsx" ? "Generating…" : "Export .xlsx"}
                  </button>
                  <button className="btn-export btn-export--csv" onClick={exportCSV} disabled={!!loading}>
                    {loading === "csv" ? <span className="spinner" /> : <Icon name="file" size={16} />}
                    {loading === "csv" ? "Generating…" : "Export CSV"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Nav footer ─────────────────────────────────────────────────────── */}
        <footer className="main-footer">
          <button className="btn-nav btn-nav--back" onClick={() => setStep(step - 1)} disabled={step === 0}>
            ← Back
          </button>
          <div className="footer-dots">
            {STEPS.map((_, i) => (
              <div key={i} className={`footer-dot${i === step ? " footer-dot--active" : i < step ? " footer-dot--done" : ""}`} />
            ))}
          </div>
          {step < STEPS.length - 1
            ? <button className="btn-nav btn-nav--next" onClick={() => setStep(step + 1)}>Next →</button>
            : <div style={{ width: 100 }} />}
        </footer>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`toast${toast.type === "error" ? " toast--error" : ""}`}>
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </div>
  );
}