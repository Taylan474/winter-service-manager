import { useState, useEffect, useMemo, useCallback, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { COMPANY_CONFIG, FEATURE_FLAGS } from "../lib/company-config";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";
import TouchTimePicker from "../components/TouchTimePicker";
import TouchCalendar from "../components/TouchCalendar";
import DateInput from "../components/DateInput";
import "../styles/workhours.css";

interface WorkLog {
  id: string;
  date: string;
  street_id: string | null;
  start_time: string;
  end_time: string;
  notes: string;
  street?: { 
    name: string;
    isBG?: boolean;
    city?: { name: string };
  };
}

interface WorkHoursProps {
  userId: string;
  userName?: string;
  role?: "admin" | "mitarbeiter" | "gast" | null;
}

interface Employee {
  id: string;
  name: string;
}

type ViewMode = "day" | "week" | "month";
type Tab = "add" | "list";
type BGFilterType = "all" | "bg" | "private";

// LocalStorage keys for persisting selections
const STORAGE_KEY_CITY = 'workhours_last_city';
const STORAGE_KEY_AREA = 'workhours_last_area';

// Quick duration presets for faster entry (in minutes)
const DURATION_PRESETS = [
  { label: "15 Min", minutes: 15 },
  { label: "30 Min", minutes: 30 },
  { label: "45 Min", minutes: 45 },
  { label: "1 Std", minutes: 60 },
];

// Calculate duration in minutes between two times (handles midnight crossover)
const calculateDurationMinutes = (startTime: string, endTime: string): number => {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let diff = (endH * 60 + endM) - (startH * 60 + startM);
  // Handle midnight crossover (e.g., 23:55 to 00:25)
  if (diff < 0) {
    diff += 24 * 60; // Add 24 hours
  }
  return diff;
};

export default function WorkHours({ userId, userName, role }: WorkHoursProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("add");
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [streets, setStreets] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedStreetId, setSelectedStreetId] = useState("");
  const [notes, setNotes] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; show: boolean }>({ 
    id: "", 
    show: false 
  });
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setCitiesLoaded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMobileStats, setShowMobileStats] = useState(false);
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type?: "error" | "warning" | "success" | "info" }>({ 
    show: false, 
    title: "", 
    message: "" 
  });
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [deleteMultipleConfirm, setDeleteMultipleConfirm] = useState(false);
  const [bgFilter, setBgFilter] = useState<BGFilterType>("all");

  // Apply duration preset - adds minutes to start time to calculate end time
  const applyDurationPreset = (minutes: number) => {
    if (!startTime) {
      // If no start time, prompt user to set it first
      setAlertModal({ 
        show: true, 
        title: "Startzeit fehlt", 
        message: "Bitte zuerst eine Startzeit eingeben!", 
        type: "warning" 
      });
      return;
    }
    
    // Calculate end time based on start time
    const [sh, sm] = startTime.split(':').map(Number);
    const totalMins = sh * 60 + sm + minutes;
    const endHour = Math.floor(totalMins / 60) % 24;
    const endMin = totalMins % 60;
    setEndTime(`${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`);
  };

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    {
      id: 'add',
      label: 'Neuer Eintrag',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
    {
      id: 'list',
      label: 'Alle Einträge',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
  ];

  // Week bounds
  const getWeekBounds = useCallback((date: Date): { monday: Date; sunday: Date } => {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
  }, []);

  // Get ISO week number
  const getWeekNumber = useCallback((date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }, []);

  // Month bounds
  const getMonthBounds = useCallback((date: Date): { first: Date; last: Date } => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { first, last };
  }, []);

  // Fetch cities
  const fetchCities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name")
        .order("name");
      
      if (error) {
        console.error("Fehler beim Laden der Städte:", error);
        return;
      }
      
      setCities(data ?? []);
      setCitiesLoaded(true);
      
      // Restore last selected city from localStorage
      const savedCityId = localStorage.getItem(STORAGE_KEY_CITY);
      if (savedCityId && data?.some(c => c.id === savedCityId)) {
        setSelectedCityId(savedCityId);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Städte:", err);
    }
  }, []);

  // Fetch areas for city
  const fetchAreas = useCallback(async (cityId: string) => {
    if (!cityId) {
      setAreas([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("areas")
        .select("id, name")
        .eq("city_id", cityId)
        .order("name");
      
      if (error) {
        console.error("Fehler beim Laden der Gebiete:", error);
        return;
      }
      
      setAreas(data ?? []);
      
      // Restore last selected area from localStorage
      const savedAreaId = localStorage.getItem(STORAGE_KEY_AREA);
      if (savedAreaId && data?.some(a => a.id === savedAreaId)) {
        setSelectedAreaId(savedAreaId);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Gebiete:", err);
    }
  }, []);

  // Fetch streets for area (or all streets for city if no area selected)
  const fetchStreets = useCallback(async (cityId: string, areaId?: string) => {
    if (!cityId) {
      setStreets([]);
      return;
    }
    
    try {
      let query = supabase
        .from("streets")
        .select(`id, name, area:areas(id, name)`)
        .eq("city_id", cityId)
        .order("name");
      
      if (areaId) {
        query = query.eq("area_id", areaId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Fehler beim Laden der Straßen:", error);
        return;
      }
      
      // Sort alphabetically
      const sortedData = (data ?? []).sort((a, b) => 
        a.name.localeCompare(b.name, 'de')
      );
      
      setStreets(sortedData);
    } catch (err) {
      console.error("Fehler beim Laden der Straßen:", err);
    }
  }, []);

  // Fetch employees for admin view
  const fetchEmployees = useCallback(async () => {
    if (role !== "admin") return;
    
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .neq("role", "gast")
        .order("name");
      
      if (error) {
        console.error("Fehler beim Laden der Mitarbeiter:", error);
        return;
      }
      
      setEmployees(data ?? []);
    } catch (err) {
      console.error("Fehler beim Laden der Mitarbeiter:", err);
    }
  }, [role]);

  // Fetch work logs for view
  const fetchWorkLogs = useCallback(async () => {
    setIsLoading(true);
    const dateString = selectedDate.toISOString().split("T")[0];
    
    // Determine which user's logs to fetch
    const targetUserId = (role === "admin" && selectedEmployeeId) ? selectedEmployeeId : userId;
    
    try {
      let query = supabase
        .from("work_logs")
        .select(`*, street:streets(name, isBG, city:cities(name))`)
        .eq("user_id", targetUserId);

      if (viewMode === "day") {
        query = query.eq("date", dateString);
      } else if (viewMode === "week") {
        const { monday, sunday } = getWeekBounds(selectedDate);
        query = query
          .gte("date", monday.toISOString().split("T")[0])
          .lte("date", sunday.toISOString().split("T")[0]);
      } else {
        const { first, last } = getMonthBounds(selectedDate);
        query = query
          .gte("date", first.toISOString().split("T")[0])
          .lte("date", last.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Fehler beim Laden der Work Logs:", error);
        setIsLoading(false);
        return;
      }
      
      const sortedData = (data ?? []).sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });
      
      setWorkLogs(sortedData);
    } catch (err) {
      console.error("Fehler beim Laden der Work Logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, viewMode, userId, role, selectedEmployeeId, getWeekBounds, getMonthBounds]);

  useEffect(() => {
    fetchCities();
  }, [fetchCities]);

  // Fetch employees for admin view
  useEffect(() => {
    if (role === "admin") {
      fetchEmployees();
    }
  }, [role, fetchEmployees]);

  // When selectedCityId changes, fetch areas
  useEffect(() => {
    if (selectedCityId) {
      fetchAreas(selectedCityId);
      localStorage.setItem(STORAGE_KEY_CITY, selectedCityId);
    } else {
      setAreas([]);
      setSelectedAreaId("");
    }
  }, [selectedCityId, fetchAreas]);

  // When selectedAreaId changes, fetch streets
  useEffect(() => {
    if (selectedCityId) {
      fetchStreets(selectedCityId, selectedAreaId || undefined);
      if (selectedAreaId) {
        localStorage.setItem(STORAGE_KEY_AREA, selectedAreaId);
      }
    }
  }, [selectedCityId, selectedAreaId, fetchStreets]);

  useEffect(() => {
    fetchWorkLogs();
  }, [fetchWorkLogs]);

  const resetForm = (preserveNextStart = false, nextStartTime = "") => {
    if (preserveNextStart && nextStartTime) {
      setStartTime(nextStartTime);
    } else {
      setStartTime("");
    }
    setEndTime("");
    setSelectedStreetId("");
    // Keep city and area selections for convenience
    setNotes("");
    setEditingLog(null);
    setShowEditModal(false);
  };

  const addWorkLog = async () => {
    if (!selectedCityId) {
      setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte wähle eine Stadt aus!", type: "warning" });
      return;
    }
    
    if (!selectedStreetId) {
      setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte wähle eine Straße aus!", type: "warning" });
      return;
    }
    
    if (!startTime || !endTime) {
      setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte Start- und Endzeit eingeben!", type: "warning" });
      return;
    }

    if (endTime <= startTime) {
      setAlertModal({ show: true, title: "Ungültige Zeit", message: "Endzeit muss nach Startzeit liegen!", type: "warning" });
      return;
    }

    const dateString = selectedDate.toISOString().split("T")[0];

    const { error } = await supabase.from("work_logs").insert({
      user_id: userId,
      date: dateString,
      street_id: selectedStreetId,
      start_time: startTime,
      end_time: endTime,
      notes: notes.trim() || null,
    });

    if (error) {
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Speichern: " + error.message, type: "error" });
      return;
    }

    // Show success message - user stays on the add tab to continue adding entries
    setAlertModal({ show: true, title: "Gespeichert!", message: "Eintrag wurde hinzugefügt.", type: "success" });
    
    // Auto-close success message after 1.5s
    setTimeout(() => {
      setAlertModal({ show: false, title: "", message: "" });
    }, 1500);
    
    // Save end time to use as next start time for continuous entry
    const nextStart = endTime;
    resetForm(true, nextStart);
    fetchWorkLogs();
    // Do NOT switch to list tab - user should stay on add tab to continue adding entries
  };

  const updateWorkLog = async () => {
    if (!editingLog) return;
    
    if (!selectedCityId) {
      setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte wähle eine Stadt aus!", type: "warning" });
      return;
    }
    
    if (!selectedStreetId) {
      setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte wähle eine Straße aus!", type: "warning" });
      return;
    }
    
    if (!startTime || !endTime) {
      setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte Start- und Endzeit eingeben!", type: "warning" });
      return;
    }

    if (endTime <= startTime) {
      setAlertModal({ show: true, title: "Ungültige Zeit", message: "Endzeit muss nach Startzeit liegen!", type: "warning" });
      return;
    }

    const { error } = await supabase
      .from("work_logs")
      .update({
        street_id: selectedStreetId,
        start_time: startTime,
        end_time: endTime,
        notes: notes.trim() || null,
      })
      .eq("id", editingLog.id);

    if (error) {
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Aktualisieren: " + error.message, type: "error" });
      return;
    }

    resetForm();
    fetchWorkLogs();
  };

  const startEditLog = async (log: WorkLog) => {
    setEditingLog(log);
    setStartTime(log.start_time);
    setEndTime(log.end_time);
    setNotes(log.notes || "");
    
    if (log.street?.city?.name) {
      const city = cities.find(c => c.name?.trim() === log.street?.city?.name?.trim());
      if (city) {
        setSelectedCityId(city.id);
        // Areas and streets will be loaded via useEffect
        // We need to wait a tick for them to load
        setTimeout(() => {
          setSelectedStreetId(log.street_id || "");
        }, 100);
      }
    } else {
      setSelectedCityId("");
      setSelectedAreaId("");
      setSelectedStreetId("");
    }
    
    setShowEditModal(true);
  };

  const deleteWorkLog = async (id: string) => {
    const { error } = await supabase
      .from("work_logs")
      .delete()
      .eq("id", id);

    if (!error) {
      fetchWorkLogs();
      setDeleteConfirm({ id: "", show: false });
    }
  };

  const deleteMultipleWorkLogs = async () => {
    if (selectedLogIds.size === 0) return;
    
    const idsToDelete = Array.from(selectedLogIds);
    const { error } = await supabase
      .from("work_logs")
      .delete()
      .in("id", idsToDelete);

    if (!error) {
      fetchWorkLogs();
      setSelectedLogIds(new Set());
      setDeleteMultipleConfirm(false);
      setAlertModal({
        show: true,
        title: "Gelöscht!",
        message: `${idsToDelete.length} Einträge wurden gelöscht.`,
        type: "success"
      });
      setTimeout(() => setAlertModal({ show: false, title: "", message: "" }), 1500);
    } else {
      setAlertModal({
        show: true,
        title: "Fehler",
        message: "Fehler beim Löschen: " + error.message,
        type: "error"
      });
    }
  };

  const toggleLogSelection = (id: string) => {
    setSelectedLogIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Stats
  const stats = useMemo(() => {
    let totalMinutes = 0;
    const daysWithEntries = new Set<string>();
    
    workLogs.forEach((log) => {
      totalMinutes += calculateDurationMinutes(log.start_time, log.end_time);
      daysWithEntries.add(log.date);
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
      totalTime: `${hours}h ${minutes}min`,
      totalHours: totalMinutes / 60,
      entryCount: workLogs.length,
      daysWorked: daysWithEntries.size,
    };
  }, [workLogs]);

  // Group logs by date for better display (applies BG filter)
  const groupedLogs = useMemo(() => {
    const groups: { date: string; formattedDate: string; logs: WorkLog[]; totalMinutes: number }[] = [];
    const dateMap = new Map<string, WorkLog[]>();
    
    // Apply BG filter first
    let filteredLogs = workLogs;
    if (FEATURE_FLAGS.enableBGFilter && bgFilter !== "all") {
      filteredLogs = workLogs.filter(log => {
        if (bgFilter === "bg") return log.street?.isBG === true;
        if (bgFilter === "private") return log.street?.isBG === false;
        return true;
      });
    }
    
    // Sort logs by date (oldest first = Monday to Sunday), then by start_time
    const sortedLogs = [...filteredLogs].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });
    
    sortedLogs.forEach(log => {
      if (!dateMap.has(log.date)) {
        dateMap.set(log.date, []);
      }
      dateMap.get(log.date)!.push(log);
    });
    
    dateMap.forEach((logs, date) => {
      const logDate = new Date(date + "T00:00:00");
      const formattedDate = logDate.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
      
      let totalMinutes = 0;
      logs.forEach(log => {
        totalMinutes += calculateDurationMinutes(log.start_time, log.end_time);
      });
      
      groups.push({ date, formattedDate, logs, totalMinutes });
    });
    
    // Sort groups by date (oldest first = Monday to Sunday)
    groups.sort((a, b) => a.date.localeCompare(b.date));
    
    return groups;
  }, [workLogs, bgFilter]);

  // Stats for filtered logs (for list view)
  const filteredStats = useMemo(() => {
    let totalMinutes = 0;
    let entryCount = 0;
    const daysWithEntries = new Set<string>();
    
    groupedLogs.forEach(group => {
      entryCount += group.logs.length;
      totalMinutes += group.totalMinutes;
      daysWithEntries.add(group.date);
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
      totalTime: `${hours}h ${minutes}min`,
      totalHours: totalMinutes / 60,
      entryCount,
      daysWorked: daysWithEntries.size,
    };
  }, [groupedLogs]);

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  const getDateRangeLabel = () => {
    if (viewMode === "day") {
      return selectedDate.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      });
    } else if (viewMode === "week") {
      const { monday, sunday } = getWeekBounds(selectedDate);
      const weekNum = getWeekNumber(selectedDate);
      const mondayStr = monday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
      const sundayStr = sunday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
      return `${mondayStr} - ${sundayStr} (KW ${weekNum})`;
    } else {
      return selectedDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    }
  };

  const exportToPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Use selected employee's name when admin is viewing their logs
    const displayName = (role === "admin" && selectedEmployeeId)
      ? employees.find(e => e.id === selectedEmployeeId)?.name || "Mitarbeiter"
      : userName || "Mitarbeiter";

    let dateString = "";
    if (viewMode === "day") {
      dateString = selectedDate.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } else if (viewMode === "week") {
      const { monday, sunday } = getWeekBounds(selectedDate);
      const mondayStr = monday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
      const sundayStr = sunday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
      const weekNum = getWeekNumber(selectedDate);
      dateString = `KW ${weekNum} (${mondayStr} - ${sundayStr})`;
    } else {
      dateString = selectedDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Arbeitsstunden - ${displayName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 40px; 
            color: #1a1a1a;
            background: #fff;
            line-height: 1.5;
          }
          .header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #646cff;
          }
          .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
          }
          .logo-section h1 { 
            font-size: 28px;
            font-weight: 700;
            color: #646cff; 
            margin-bottom: 4px;
            letter-spacing: -0.5px;
          }
          .logo-section .subtitle { 
            color: #666; 
            font-size: 14px;
            font-weight: 500;
          }
          .header-info {
            display: flex;
            gap: 40px;
            margin-top: 12px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
          }
          .info-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #888;
            margin-bottom: 2px;
          }
          .info-value {
            font-size: 18px;
            font-weight: 700;
            color: #1a1a1a;
          }
          .info-value.primary {
            color: #646cff;
          }
          .total-box {
            background: linear-gradient(135deg, #646cff 0%, #535bf2 100%);
            color: #fff;
            padding: 16px 24px;
            border-radius: 12px;
            text-align: center;
          }
          .total-box .info-label {
            color: rgba(255,255,255,0.8);
          }
          .total-box .info-value {
            color: #fff;
            font-size: 24px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 8px;
            font-size: 12px;
          }
          th { 
            background: #646cff; 
            color: white;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          th:first-child { border-radius: 8px 0 0 0; }
          th:last-child { border-radius: 0 8px 0 0; }
          td { 
            padding: 10px; 
            border-bottom: 1px solid #eee;
            color: #333;
          }
          tr:nth-child(even) { background-color: #fafbff; }
          tr:hover { background-color: #f0f1ff; }
          .duration-cell {
            background: #e8f5e9;
            color: #2e7d32;
            font-weight: 600;
            border-radius: 4px;
            padding: 4px 8px;
            display: inline-block;
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 20px;
            border-top: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #999; 
            font-size: 11px;
          }
          .footer-left { }
          .footer-right { text-align: right; }
          .day-section {
            margin-bottom: 24px;
            page-break-inside: avoid;
          }
          .day-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: linear-gradient(135deg, #f8f9ff 0%, #f0f1ff 100%);
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 8px;
            border-left: 4px solid #646cff;
          }
          .day-date {
            font-size: 14px;
            font-weight: 700;
            color: #1a1a1a;
          }
          .day-stats {
            font-size: 13px;
            font-weight: 600;
            color: #646cff;
          }
          @media print {
            body { padding: 20px; }
            tr { break-inside: avoid; }
            .day-section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-top">
            <div class="logo-section">
              <h1>Arbeitsstunden${bgFilter !== "all" ? ` (${bgFilter === "bg" ? "Nur BG" : "Nur Privat"})` : ""}</h1>
              <p class="subtitle">${COMPANY_CONFIG.name} - ${COMPANY_CONFIG.serviceName}</p>
            </div>
            <div class="total-box">
              <span class="info-label">Gesamtzeit</span>
              <span class="info-value">${filteredStats.totalTime}</span>
            </div>
          </div>
          <div class="header-info">
            <div class="info-item">
              <span class="info-label">Mitarbeiter</span>
              <span class="info-value">${displayName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Zeitraum</span>
              <span class="info-value">${dateString}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Arbeitstage</span>
              <span class="info-value">${filteredStats.daysWorked}</span>
            </div>
          </div>
        </div>

        <div class="section-title">Detaillierte Übersicht</div>
        
        ${groupedLogs.map((group) => {
          const groupHours = Math.floor(group.totalMinutes / 60);
          const groupMins = group.totalMinutes % 60;
          
          return `
            <div class="day-section">
              <div class="day-header">
                <span class="day-date">${group.formattedDate}</span>
                <span class="day-stats">${group.logs.length} ${group.logs.length === 1 ? 'Eintrag' : 'Einträge'} • ${groupHours}h ${groupMins}min</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Stadt</th>
                    <th>Straße</th>
                    <th>Von</th>
                    <th>Bis</th>
                    <th>Dauer</th>
                    <th>Notizen</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.logs.map((log) => {
                    const diffMinutes = calculateDurationMinutes(log.start_time, log.end_time);
                    const hours = Math.floor(diffMinutes / 60);
                    const minutes = diffMinutes % 60;
                    const bgBadge = FEATURE_FLAGS.enableBGFilter && log.street?.isBG 
                      ? ' <span style="background:#10b981;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;margin-left:6px;">BG</span>' 
                      : '';
                    
                    return '<tr>' +
                      '<td>' + (log.street?.city?.name || "-") + '</td>' +
                      '<td>' + (log.street?.name || "-") + bgBadge + '</td>' +
                      '<td>' + log.start_time + '</td>' +
                      '<td>' + log.end_time + '</td>' +
                      '<td><span class="duration-cell">' + hours + 'h ' + minutes + 'min</span></td>' +
                      '<td>' + (log.notes || "-") + '</td>' +
                      '</tr>';
                  }).join("")}
                </tbody>
              </table>
            </div>
          `;
        }).join("")}
        
        <div class="footer">
          <div class="footer-left">
            ${COMPANY_CONFIG.footerText}
          </div>
          <div class="footer-right">
            Erstellt: ${new Date().toLocaleDateString("de-DE")} um ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="workhours-page">
      <div className="workhours-header">
        <button onClick={() => navigate('/')} className="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Zurück
        </button>
        <div className="workhours-title">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <h1>Meine Arbeitsstunden</h1>
        </div>
      </div>

      <div className="workhours-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="workhours-content">
        {activeTab === "add" && (
          <div className="manager-section">
            {/* Header like other tabs */}
            <div className="manager-header">
              <h2>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Neuer Eintrag
              </h2>
            </div>

            {/* Two column layout */}
            <div className="new-entry-layout">
              {/* Left: Form */}
              <div className="new-entry-form-section">
                {/* Date Selection Bar - like date-navigation */}
                <div className="date-navigation compact">
                  <div className="date-nav" style={{ flex: 1, justifyContent: 'center' }}>
                    <button onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() - 1);
                      setSelectedDate(newDate);
                    }} className="nav-btn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <button 
                      className="date-picker-btn-inline"
                      onClick={() => setShowDatePicker(true)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {selectedDate.toLocaleDateString("de-DE", { 
                        weekday: "long", 
                        day: "2-digit", 
                        month: "long", 
                        year: "numeric" 
                      })}
                    </button>
                    <button onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() + 1);
                      setSelectedDate(newDate);
                    }} className="nav-btn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                    <button onClick={() => setSelectedDate(new Date())} className="today-btn">Heute</button>
                  </div>
                </div>

                {/* Form Grid */}
                <div className="entry-form-grid">
                  {/* Location Row */}
                  <div className="form-card">
                    <div className="form-card-header">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      Arbeitsort
                    </div>
                    <div className="form-card-body">
                      <div className="form-field-inline">
                        <label>Stadt</label>
                        <select
                          value={selectedCityId}
                          onChange={(e) => {
                            setSelectedCityId(e.target.value);
                            setSelectedAreaId("");
                            setSelectedStreetId("");
                          }}
                        >
                          <option value="">Stadt wählen...</option>
                          {cities.map((c) => (
                            <option key={c.id} value={c.id}>{c.name?.trim()}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field-inline">
                        <label>Gebiet</label>
                        <select
                          value={selectedAreaId}
                          onChange={(e) => {
                            setSelectedAreaId(e.target.value);
                            setSelectedStreetId("");
                          }}
                          disabled={!selectedCityId}
                        >
                          <option value="">Alle Gebiete</option>
                          {areas.sort((a, b) => a.name.localeCompare(b.name, 'de')).map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field-inline">
                        <label>Straße</label>
                        <select
                          value={selectedStreetId}
                          onChange={(e) => setSelectedStreetId(e.target.value)}
                          disabled={!selectedCityId}
                        >
                          <option value="">Straße wählen...</option>
                          {streets.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} {!selectedAreaId && s.area?.name ? `(${s.area.name})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Time Row */}
                  <div className="form-card">
                    <div className="form-card-header">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Arbeitszeit
                    </div>
                    
                    {/* Duration Presets */}
                    <div className="time-presets">
                      <span className="presets-label">Dauer hinzufügen:</span>
                      <div className="presets-grid">
                        {DURATION_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className="preset-btn duration-btn"
                            onClick={() => applyDurationPreset(preset.minutes)}
                          >
                            <span className="preset-name">{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="form-card-body time-inputs">
                      <div className="time-field">
                        <span className="time-label">Von</span>
                        <TouchTimePicker value={startTime} onChange={setStartTime} label="Startzeit" />
                      </div>
                      <div className="time-separator">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </div>
                      <div className="time-field">
                        <span className="time-label">Bis</span>
                        <TouchTimePicker value={endTime} onChange={setEndTime} label="Endzeit" />
                      </div>
                      {startTime && endTime && (
                        <div className="duration-preview">
                          {(() => {
                            const [sh, sm] = startTime.split(':').map(Number);
                            const [eh, em] = endTime.split(':').map(Number);
                            const diff = (eh * 60 + em) - (sh * 60 + sm);
                            if (diff > 0) {
                              const hours = Math.floor(diff / 60);
                              const mins = diff % 60;
                              return `= ${hours}h ${mins > 0 ? mins + 'm' : ''}`;
                            }
                            return '';
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="form-card full-width">
                    <div className="form-card-header">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      Notizen (optional)
                    </div>
                    <div className="form-card-body">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="z.B. Salz gestreut, Schnee geräumt, besondere Vorkommnisse..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="quick-actions">
                  <button onClick={addWorkLog} className="add-btn primary-action">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Eintrag speichern
                  </button>
                  <button onClick={() => setActiveTab("list")} className="export-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    Alle Einträge anzeigen
                  </button>
                </div>
              </div>

              {/* Right: Quick Stats & Recent - Collapsible on mobile */}
              <div className="new-entry-sidebar">
                {/* Mobile toggle button */}
                <button 
                  className="mobile-stats-toggle"
                  onClick={() => setShowMobileStats(!showMobileStats)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                    <path d="M22 12A10 10 0 0 0 12 2v10z" />
                  </svg>
                  Statistiken anzeigen
                  <svg 
                    width="16" height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className={`toggle-chevron ${showMobileStats ? 'open' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Stats content - always visible on desktop, collapsible on mobile */}
                <div className={`sidebar-content ${showMobileStats ? 'mobile-open' : ''}`}>
                  <div className="sidebar-card">
                    <h3>Heute</h3>
                    <div className="sidebar-stat">
                      <span className="stat-number">
                        {workLogs.filter(l => {
                          const logDate = new Date(l.date);
                          const today = new Date();
                          return logDate.toDateString() === today.toDateString();
                        }).length}
                      </span>
                      <span className="stat-text">Einträge</span>
                    </div>
                  </div>
                  
                  <div className="sidebar-card">
                    <h3>Diese Woche (KW {getWeekNumber(new Date())})</h3>
                    <div className="sidebar-stat">
                      <span className="stat-number">{stats.entryCount}</span>
                      <span className="stat-text">Einträge</span>
                    </div>
                    <div className="sidebar-stat small">
                      <span className="stat-number">{stats.totalTime}</span>
                      <span className="stat-text">Arbeitszeit</span>
                    </div>
                  </div>

                  {workLogs.length > 0 && (
                    <div className="sidebar-card recent">
                      <h3>Letzter Eintrag</h3>
                      <div className="recent-entry">
                        <span className="recent-date">
                          {new Date(workLogs[0]?.date).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                        </span>
                        <span className="recent-location">
                          {workLogs[0]?.street?.city?.name || "—"}, {workLogs[0]?.street?.name || "—"}
                        </span>
                        <span className="recent-time">
                          {workLogs[0]?.start_time?.slice(0,5)} - {workLogs[0]?.end_time?.slice(0,5)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TouchCalendar Modal */}
            {showDatePicker && (
              <TouchCalendar
                selectedDate={selectedDate}
                onDateChange={(date) => {
                  setSelectedDate(date);
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </div>
        )}

        {activeTab === "list" && (
          <div className="manager-section">
            <div className="manager-header">
              <h2>
                {role === "admin" && selectedEmployeeId 
                  ? `Einträge von ${employees.find(e => e.id === selectedEmployeeId)?.name || "Mitarbeiter"}` 
                  : "Alle Einträge"
                } ({filteredStats.entryCount}{bgFilter !== "all" ? ` von ${workLogs.length}` : ""})
              </h2>
              <div className="header-actions">
                {selectedLogIds.size > 0 && (
                  <button
                    onClick={() => setDeleteMultipleConfirm(true)}
                    className="delete-selected-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    {selectedLogIds.size} löschen
                  </button>
                )}
                {filteredStats.entryCount > 0 && (
                  <button onClick={exportToPDF} className="export-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    PDF Export{bgFilter !== "all" ? ` (${bgFilter === "bg" ? "BG" : "Privat"})` : ""}
                  </button>
                )}
              </div>
            </div>

            {/* Admin Employee Selector */}
            {role === "admin" && employees.length > 0 && (
              <div className="employee-selector">
                <label>Mitarbeiter anzeigen:</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                >
                  <option value="">Meine Einträge</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}{emp.id === userId ? " (ich)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Navigation */}
            <div className="date-navigation compact">
              <div className="view-toggle">
                <button className={viewMode === "day" ? "active" : ""} onClick={() => setViewMode("day")}>Tag</button>
                <button className={viewMode === "week" ? "active" : ""} onClick={() => setViewMode("week")}>Woche</button>
                <button className={viewMode === "month" ? "active" : ""} onClick={() => setViewMode("month")}>Monat</button>
              </div>
              
              <div className="date-nav">
                <button onClick={() => navigateDate("prev")} className="nav-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span className="date-label">{getDateRangeLabel()}</span>
                <button onClick={() => navigateDate("next")} className="nav-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button onClick={() => setSelectedDate(new Date())} className="today-btn">Heute</button>
              </div>
            </div>

            {/* BG Filter (only when enabled) */}
            {FEATURE_FLAGS.enableBGFilter && (
              <div className="bg-filter-bar">
                <span className="filter-label">Typ:</span>
                <div className="filter-buttons">
                  <button
                    className={`filter-btn ${bgFilter === "all" ? "active" : ""}`}
                    onClick={() => setBgFilter("all")}
                  >
                    Alle
                  </button>
                  <button
                    className={`filter-btn ${bgFilter === "bg" ? "active" : ""}`}
                    onClick={() => setBgFilter("bg")}
                  >
                    Nur BG
                  </button>
                  <button
                    className={`filter-btn ${bgFilter === "private" ? "active" : ""}`}
                    onClick={() => setBgFilter("private")}
                  >
                    Nur Privat
                  </button>
                </div>
              </div>
            )}

            {/* Stats Summary */}
            <div className="list-stats-bar">
              <div className="list-stat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="list-stat-value">{filteredStats.totalTime}</span>
                <span className="list-stat-label">Gesamtzeit</span>
              </div>
              <div className="list-stat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="list-stat-value">{filteredStats.daysWorked}</span>
                <span className="list-stat-label">{filteredStats.daysWorked === 1 ? 'Tag' : 'Tage'}</span>
              </div>
            </div>

            {isLoading ? (
              <div className="empty-state">
                <div className="spinner"></div>
                <p>Lädt Einträge...</p>
              </div>
            ) : workLogs.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <h3>Keine Einträge</h3>
                <p>Keine Einträge für diesen Zeitraum gefunden.</p>
                <button className="add-btn" onClick={() => setActiveTab("add")}>
                  Ersten Eintrag erstellen
                </button>
              </div>
            ) : (
              <div className="logs-grouped-container">
                {groupedLogs.map((group) => {
                  const groupHours = Math.floor(group.totalMinutes / 60);
                  const groupMins = group.totalMinutes % 60;
                  const allGroupSelected = group.logs.every(log => selectedLogIds.has(log.id));
                  const someGroupSelected = group.logs.some(log => selectedLogIds.has(log.id));
                  
                  const toggleGroupSelection = () => {
                    setSelectedLogIds(prev => {
                      const newSet = new Set(prev);
                      if (allGroupSelected) {
                        group.logs.forEach(log => newSet.delete(log.id));
                      } else {
                        group.logs.forEach(log => newSet.add(log.id));
                      }
                      return newSet;
                    });
                  };
                  
                  return (
                    <div key={group.date} className="day-group">
                      <div className="day-group-header">
                        <div className="day-group-left">
                          <input
                            type="checkbox"
                            checked={allGroupSelected}
                            ref={(el) => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                            onChange={toggleGroupSelection}
                            className="select-checkbox"
                          />
                          <span className="day-group-date">{group.formattedDate}</span>
                        </div>
                        <div className="day-group-stats">
                          <span className="day-group-count">{group.logs.length} {group.logs.length === 1 ? 'Eintrag' : 'Einträge'}</span>
                          <span className="day-group-duration">{groupHours}h {groupMins}min</span>
                        </div>
                      </div>
                      <div className="day-group-entries">
                        {group.logs.map((log) => {
                          const diffMinutes = calculateDurationMinutes(log.start_time, log.end_time);
                          const hours = Math.floor(diffMinutes / 60);
                          const minutes = diffMinutes % 60;

                          return (
                            <div key={log.id} className={`entry-row ${selectedLogIds.has(log.id) ? 'selected' : ''}`}>
                              <div className="entry-checkbox">
                                <input
                                  type="checkbox"
                                  checked={selectedLogIds.has(log.id)}
                                  onChange={() => toggleLogSelection(log.id)}
                                  className="select-checkbox"
                                />
                              </div>
                              <div className="entry-time">
                                {log.start_time.slice(0, 5)} - {log.end_time.slice(0, 5)}
                              </div>
                              <div className="entry-street">
                                <span className="entry-city">{log.street?.city?.name || "-"}</span>
                                <span className="entry-street-name">
                                  {log.street?.name || "-"}
                                  {FEATURE_FLAGS.enableBGFilter && log.street?.isBG && (
                                    <span className="bg-badge-inline">BG</span>
                                  )}
                                </span>
                              </div>
                              <div className="entry-duration">
                                <span className="duration-badge">{hours}h {minutes}min</span>
                              </div>
                              {log.notes && (
                                <div className="entry-notes">{log.notes}</div>
                              )}
                              <div className="entry-actions">
                                <button 
                                  className="action-btn" 
                                  onClick={() => startEditLog(log)}
                                  title="Bearbeiten"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button 
                                  className="action-btn delete"
                                  onClick={() => setDeleteConfirm({ id: log.id, show: true })}
                                  title="Löschen"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingLog && (
        <div className="form-modal-overlay" onClick={() => resetForm()}>
          <div className="form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="form-modal-header">
              <h3>Eintrag bearbeiten</h3>
              <button onClick={() => resetForm()} className="close-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="form-modal-body">
              <div className="form-group">
                <label>Datum</label>
                <DateInput
                  value={editingLog.date}
                  onChange={() => {}}
                  disabled={true}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Stadt *</label>
                  <select
                    value={selectedCityId}
                    onChange={(e) => {
                      setSelectedCityId(e.target.value);
                      setSelectedAreaId("");
                      setSelectedStreetId("");
                    }}
                  >
                    <option value="">- Stadt wählen -</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name?.trim()}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Gebiet</label>
                  <select
                    value={selectedAreaId}
                    onChange={(e) => {
                      setSelectedAreaId(e.target.value);
                      setSelectedStreetId("");
                    }}
                    disabled={!selectedCityId}
                  >
                    <option value="">Alle Gebiete</option>
                    {areas.sort((a, b) => a.name.localeCompare(b.name, 'de')).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Straße *</label>
                  <select
                    value={selectedStreetId}
                    onChange={(e) => setSelectedStreetId(e.target.value)}
                    disabled={!selectedCityId}
                  >
                    <option value="">- Straße wählen -</option>
                    {streets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {!selectedAreaId && s.area?.name ? `(${s.area.name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Von *</label>
                  <TouchTimePicker value={startTime} onChange={setStartTime} label="Startzeit" />
                </div>
                <div className="form-group">
                  <label>Bis *</label>
                  <TouchTimePicker value={endTime} onChange={setEndTime} label="Endzeit" />
                </div>
              </div>
              
              <div className="form-group">
                <label>Notizen</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="z.B. Salz gestreut..."
                />
              </div>
            </div>
            <div className="form-modal-footer">
              <button onClick={() => resetForm()} className="btn-cancel">Abbrechen</button>
              <button onClick={updateWorkLog} className="btn-save">Speichern</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm.show && (
        <ConfirmModal
          title="Eintrag löschen?"
          message="Möchten Sie diesen Arbeitseintrag wirklich löschen?"
          confirmText="Löschen"
          cancelText="Abbrechen"
          onConfirm={() => deleteWorkLog(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm({ id: "", show: false })}
          danger={true}
        />
      )}

      {deleteMultipleConfirm && (
        <ConfirmModal
          title={`${selectedLogIds.size} Einträge löschen?`}
          message={`Möchten Sie wirklich ${selectedLogIds.size} ausgewählte Einträge löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmText={`${selectedLogIds.size} löschen`}
          cancelText="Abbrechen"
          onConfirm={deleteMultipleWorkLogs}
          onCancel={() => setDeleteMultipleConfirm(false)}
          danger={true}
        />
      )}

      {alertModal.show && (
        <AlertModal
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal({ show: false, title: "", message: "" })}
        />
      )}
    </div>
  );
}
