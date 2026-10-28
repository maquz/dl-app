import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  fetchSampleSchools,
  fetchSampleSchoolHierarchy,
  fetchSampleSchoolStats,
  fetchSampleSchoolParticipants,
} from "../api";

export default function SampleSchoolsAdminTab({ onBulkUpload, assessmentsList = [] }) {
  const [activeSubTab, setActiveSubTab] = useState("schools"); // 'schools' | 'participants'
  const [stats, setStats] = useState(null);
  const [hierarchy, setHierarchy] = useState({ regions: [], districtsByRegion: {} });

  // Schools list state
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  // Participants list state
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");

  // Load initial data
  useEffect(() => {
    loadStats();
    fetchSampleSchoolHierarchy()
      .then(setHierarchy)
      .catch((err) => console.error("Error loading hierarchy:", err));
  }, []);

  // Load schools when filters change
  useEffect(() => {
    loadSchools();
  }, [regionFilter, districtFilter, groupFilter, schoolSearch]);

  // Load participants when filters change
  useEffect(() => {
    if (activeSubTab === "participants") {
      loadParticipants();
    }
  }, [activeSubTab, regionFilter, districtFilter, groupFilter, designationFilter, participantSearch]);

  async function loadStats() {
    try {
      const data = await fetchSampleSchoolStats();
      setStats(data);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  }

  async function loadSchools() {
    setLoadingSchools(true);
    try {
      const data = await fetchSampleSchools({
        region: regionFilter,
        district: districtFilter,
        group_id: groupFilter,
        search: schoolSearch,
      });
      setSchools(data.schools || []);
    } catch (err) {
      console.error("Error loading sample schools:", err);
    } finally {
      setLoadingSchools(false);
    }
  }

  async function loadParticipants() {
    setLoadingParticipants(true);
    try {
      const data = await fetchSampleSchoolParticipants({
        region: regionFilter,
        district: districtFilter,
        group_id: groupFilter,
        designation: designationFilter,
        search: participantSearch,
      });
      setParticipants(data.participants || []);
    } catch (err) {
      console.error("Error loading participants:", err);
    } finally {
      setLoadingParticipants(false);
    }
  }

  function handleRegionChange(e) {
    setRegionFilter(e.target.value);
    setDistrictFilter("");
  }

  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Schools
    const schoolRows = schools.map((s, idx) => ({
      "S/N": idx + 1,
      "Region": s.region,
      "District": s.district,
      "EMIS Code": s.emis_code,
      "School Name": s.school_name,
      "Study Group": s.group_id,
      "Treatment Protocol": s.treatment,
    }));
    const wsSchools = XLSX.utils.json_to_sheet(schoolRows);
    XLSX.utils.book_append_sheet(wb, wsSchools, "Sample Schools (210)");

    // Sheet 2: Registered Participants
    const participantRows = participants.map((p, idx) => ({
      "S/N": idx + 1,
      "Reference Code": p.referenceCode,
      "Officer Name": p.officerName,
      "Sex": p.sex,
      "Phone Number": p.phoneNumber,
      "Designation": p.designation,
      "School Name": p.schoolName,
      "EMIS Code": p.emisCode,
      "Study Group": p.studyGroup,
      "Region": p.region,
      "District": p.district,
      "Registration Date": p.submittedAt,
    }));
    const wsParticipants = XLSX.utils.json_to_sheet(participantRows);
    XLSX.utils.book_append_sheet(wb, wsParticipants, "Registered Staff");

    XLSX.writeFile(wb, `GALOP_Sample_Schools_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const samplePreTest = assessmentsList.find(
    (a) => a.id === 4 || (a.target_program === "sample_school" && a.type === "Pre-Test")
  );
  const samplePostTest = assessmentsList.find(
    (a) => a.id === 5 || (a.target_program === "sample_school" && a.type === "Post-Test")
  );

  return (
    <div className="sample-schools-admin-container" style={{ padding: "0.5rem 0" }}>
      {/* Header Banner */}
      <div
        className="trainers-mgmt-header"
        style={{
          background: "linear-gradient(135deg, #1e293b, #0f172a)",
          color: "#ffffff",
          padding: "1.75rem",
          borderRadius: "14px",
          marginBottom: "1.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.25rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🏫</span>
            <span style={{ fontSize: "0.82rem", background: "rgba(59, 130, 246, 0.3)", color: "#93c5fd", padding: "0.2rem 0.6rem", borderRadius: "999px", fontWeight: 700 }}>
              EXPERIMENTAL STUDY TRACK (210 SAMPLE SCHOOLS)
            </span>
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#ffffff" }}>
            GALOP AF2 Sample Schools Workshop Management
          </h2>
          <p style={{ margin: "0.35rem 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>
            4 Regions · 12 Districts · 210 Public Primary Schools (70 per Arm) · Dates: 27th – 29th Oct 2026
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a", fontWeight: 700, fontSize: "0.85rem" }}
            onClick={() => {
              if (onBulkUpload && samplePreTest) {
                onBulkUpload(samplePreTest);
              } else if (onBulkUpload) {
                onBulkUpload({ id: 4, title: "GALOP AF2 Sample Schools: Pre-Training Assessment", type: "Pre-Test" });
              }
            }}
          >
            📥 Upload Pre-Test (Schools)
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0", fontWeight: 700, fontSize: "0.85rem" }}
            onClick={() => {
              if (onBulkUpload && samplePostTest) {
                onBulkUpload(samplePostTest);
              } else if (onBulkUpload) {
                onBulkUpload({ id: 5, title: "GALOP AF2 Sample Schools: Post-Training Assessment", type: "Post-Test" });
              }
            }}
          >
            📥 Upload Post-Test (Schools)
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ background: "#ffffff", color: "#0f172a", fontWeight: 700, fontSize: "0.85rem" }}
            onClick={handleExportExcel}
          >
            📊 Export Data (Excel)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="analytics-grid" style={{ marginBottom: "1.75rem" }}>
        <div className="kpi-card" style={{ borderLeft: "4px solid #3b82f6" }}>
          <span className="kpi-label">Sample Schools</span>
          <span className="kpi-val text-navy">210 Schools</span>
          <span className="kpi-hint">70 Group 1 · 70 Group 2 · 70 Group 3</span>
        </div>

        <div className="kpi-card" style={{ borderLeft: "4px solid #10b981" }}>
          <span className="kpi-label">Staff Registered</span>
          <span className="kpi-val text-green" style={{ color: "#16a34a" }}>
            {stats?.totalRegistered || 0}
          </span>
          <span className="kpi-hint">
            {stats?.byDesignation?.headteachers || 0} Headteachers · {stats?.byDesignation?.teachers || 0} Teachers
          </span>
        </div>

        <div className="kpi-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <span className="kpi-label">Schools Coverage</span>
          <span className="kpi-val text-navy">
            {stats?.schoolsRepresented || 0} / 210
          </span>
          <span className="kpi-hint">
            {stats?.coveragePct || 0}% of schools represented
          </span>
        </div>

        <div className="kpi-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <span className="kpi-label">Group 1 (Normal DL)</span>
          <span className="kpi-val" style={{ color: "#2563eb" }}>
            {stats?.byGroup?.["Group 1"] || 0} registered
          </span>
          <span className="kpi-hint">Status quo DL coaching</span>
        </div>

        <div className="kpi-card" style={{ borderLeft: "4px solid #ec4899" }}>
          <span className="kpi-label">Group 2 (T1) & Group 3 (T2)</span>
          <span className="kpi-val" style={{ color: "#059669" }}>
            {(stats?.byGroup?.["Group 2"] || 0) + (stats?.byGroup?.["Group 3"] || 0)} registered
          </span>
          <span className="kpi-hint">Mandatory midterm & pacing</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #e2e8f0", marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveSubTab("schools")}
          style={{
            padding: "0.75rem 1.25rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: activeSubTab === "schools" ? "3px solid #2563eb" : "3px solid transparent",
            color: activeSubTab === "schools" ? "#2563eb" : "#64748b",
            cursor: "pointer",
          }}
        >
          🏫 210 Sample Schools Catalog ({schools.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("participants")}
          style={{
            padding: "0.75rem 1.25rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: activeSubTab === "participants" ? "3px solid #2563eb" : "3px solid transparent",
            color: activeSubTab === "participants" ? "#2563eb" : "#64748b",
            cursor: "pointer",
          }}
        >
          👥 Registered Staff ({stats?.totalRegistered || 0})
        </button>
      </div>

      {/* Filters Toolbar */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "1rem",
          marginBottom: "1.5rem",
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <input
            type="search"
            placeholder={activeSubTab === "schools" ? "Search school name or EMIS code..." : "Search staff name, phone, school..."}
            value={activeSubTab === "schools" ? schoolSearch : participantSearch}
            onChange={(e) => {
              if (activeSubTab === "schools") setSchoolSearch(e.target.value);
              else setParticipantSearch(e.target.value);
            }}
            style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div style={{ minWidth: "150px" }}>
          <select
            value={regionFilter}
            onChange={handleRegionChange}
            style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          >
            <option value="">All 4 Regions</option>
            {hierarchy.regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {regionFilter && hierarchy.districtsByRegion[regionFilter] && (
          <div style={{ minWidth: "160px" }}>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            >
              <option value="">All Districts in {regionFilter}</option>
              {hierarchy.districtsByRegion[regionFilter].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ minWidth: "160px" }}>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          >
            <option value="">All Study Groups</option>
            <option value="Group 1">Group 1 (Normal DL)</option>
            <option value="Group 2">Group 2 (T1: Midterm Check)</option>
            <option value="Group 3">Group 3 (T2: Midterm + Pacing)</option>
          </select>
        </div>

        {activeSubTab === "participants" && (
          <div style={{ minWidth: "150px" }}>
            <select
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
              style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            >
              <option value="">All Roles</option>
              <option value="Headteacher">Headteacher</option>
              <option value="Teacher">Teacher</option>
            </select>
          </div>
        )}

        {(regionFilter || districtFilter || groupFilter || designationFilter || schoolSearch || participantSearch) && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setRegionFilter("");
              setDistrictFilter("");
              setGroupFilter("");
              setDesignationFilter("");
              setSchoolSearch("");
              setParticipantSearch("");
            }}
            style={{ padding: "0.55rem 0.85rem", fontSize: "0.85rem" }}
          >
            Clear Filters ✕
          </button>
        )}
      </div>

      {/* SUB-VIEW 1: SCHOOLS CATALOG */}
      {activeSubTab === "schools" && (
        <div className="table-wrap">
          <table className="assessments-admin-table">
            <thead>
              <tr>
                <th style={{ width: "6%" }}>S/N</th>
                <th style={{ width: "14%" }}>EMIS Code</th>
                <th style={{ width: "30%" }}>School Name</th>
                <th style={{ width: "18%" }}>Region & District</th>
                <th style={{ width: "14%" }}>Study Group</th>
                <th style={{ width: "18%" }}>Experimental Treatment</th>
              </tr>
            </thead>
            <tbody>
              {loadingSchools && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    Loading sample schools…
                  </td>
                </tr>
              )}
              {!loadingSchools && schools.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No schools found matching your search.
                  </td>
                </tr>
              )}
              {schools.map((s, idx) => (
                <tr key={s.id}>
                  <td>{s.sn || idx + 1}</td>
                  <td>
                    <span
                      style={{
                        fontFamily: "monospace",
                        background: "#f1f5f9",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "6px",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {s.emis_code}
                    </span>
                  </td>
                  <td>
                    <strong>{s.school_name}</strong>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{s.region}</span>
                      <span style={{ fontSize: "0.82rem", color: "#64748b" }}>{s.district}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.65rem",
                        borderRadius: "999px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        background:
                          s.group_id === "Group 1"
                            ? "#dbeafe"
                            : s.group_id === "Group 2"
                            ? "#fef3c7"
                            : "#dcfce7",
                        color:
                          s.group_id === "Group 1"
                            ? "#1e40af"
                            : s.group_id === "Group 2"
                            ? "#92400e"
                            : "#166534",
                      }}
                    >
                      {s.group_id}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.82rem", color: "#475569" }}>{s.treatment}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-VIEW 2: REGISTERED PARTICIPANTS */}
      {activeSubTab === "participants" && (
        <div className="table-wrap">
          <table className="assessments-admin-table">
            <thead>
              <tr>
                <th style={{ width: "14%" }}>Ref Code</th>
                <th style={{ width: "22%" }}>Staff Name & Sex</th>
                <th style={{ width: "12%" }}>Designation</th>
                <th style={{ width: "14%" }}>Phone Number</th>
                <th style={{ width: "22%" }}>School & EMIS</th>
                <th style={{ width: "16%" }}>Study Group</th>
              </tr>
            </thead>
            <tbody>
              {loadingParticipants && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    Loading participants…
                  </td>
                </tr>
              )}
              {!loadingParticipants && participants.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No participants registered yet under the sample schools track.
                  </td>
                </tr>
              )}
              {participants.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="ref-tag" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                      {p.referenceCode}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <strong>{p.officerName}</strong>
                      <span style={{ fontSize: "0.82rem", color: "#64748b" }}>{p.sex}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "0.25rem 0.6rem",
                        borderRadius: "6px",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        background: p.designation === "Headteacher" ? "#ede9fe" : "#ccfbf1",
                        color: p.designation === "Headteacher" ? "#6d28d9" : "#0f766e",
                      }}
                    >
                      {p.designation}
                    </span>
                  </td>
                  <td>
                    <a href={`tel:${p.phoneNumber}`} className="phone-link">
                      {p.phoneNumber}
                    </a>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <strong>{p.schoolName}</strong>
                      <span style={{ fontSize: "0.8rem", color: "#64748b", fontFamily: "monospace" }}>
                        EMIS: {p.emisCode}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "999px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        background:
                          p.studyGroup === "Group 1"
                            ? "#dbeafe"
                            : p.studyGroup === "Group 2"
                            ? "#fef3c7"
                            : "#dcfce7",
                        color:
                          p.studyGroup === "Group 1"
                            ? "#1e40af"
                            : p.studyGroup === "Group 2"
                            ? "#92400e"
                            : "#166534",
                      }}
                    >
                      {p.studyGroup}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
