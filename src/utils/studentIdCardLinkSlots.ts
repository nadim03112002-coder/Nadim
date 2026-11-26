import { get, onValue, ref, set } from "firebase/database";
import { db, ensureFirebaseAuthSession, rtdb } from "../firebase";
import { sbBridgeGetDoc, sbBridgeSetDoc, sbDoc } from "../services/supabaseSchoolBridge";
import { sbRtdbGet, sbRtdbSet } from "../services/supabaseDbAdapter";
import type { School, SchoolPlanTierName, StudentIdCardLinkSlot } from "../school-types";
import { getSchoolPlanTierName, getSchoolStudentAccountLimit } from "../school-types";

const LINK_DEVICE_ID_KEY = "nst_link_device_id";
const PUSH_DEVICE_ID_KEY = "nst_push_device_id";

export interface StudentLinkSlotRecord {
  studentId: string;
  schoolId: string;
  limit: 1 | 2 | 4;
  planName: SchoolPlanTierName;
  slots: StudentIdCardLinkSlot[];
  updatedAt: string;
}

const withTimeout = <T>(promise: Promise<T>, ms = 2500): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);

export const cleanSlotRtdbKey = (val: string): string =>
  String(val || "guest").trim().replace(/[.#$[\]/]/g, "_");

export const getOrCreateLinkDeviceId = (): string => {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(LINK_DEVICE_ID_KEY);
    if (!id) {
      const pushDev = localStorage.getItem(PUSH_DEVICE_ID_KEY);
      id =
        pushDev ||
        `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(LINK_DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "browser";
  }
};

export const resolveStudentLinkHolder = (params: {
  uid?: string | null;
  studentId: string;
  holderLabel?: string;
  deviceId?: string;
}): {
  holderKey: string;
  holderUid: string;
  deviceId: string;
  holderLabel: string;
} => {
  const cleanStu = String(params.studentId || "").trim();
  const cleanUid = String(params.uid || "").trim();
  const devId = String(params.deviceId || getOrCreateLinkDeviceId()).trim();

  // Separate User Account UID -> bind permanently to that User ID across sessions
  if (cleanUid && cleanUid !== cleanStu) {
    return {
      holderKey: cleanSlotRtdbKey(cleanUid),
      holderUid: cleanUid,
      deviceId: devId,
      holderLabel: params.holderLabel || cleanUid,
    };
  }

  // Direct Student ID Card QR / Face Login -> distinguish each device/browser cleanly
  return {
    holderKey: cleanSlotRtdbKey(`${cleanStu}__dev_${devId}`),
    holderUid: cleanStu,
    deviceId: devId,
    holderLabel: params.holderLabel || `Device (${devId.slice(-6)})`,
  };
};

const fetchSchoolForSlotLimit = async (
  schoolId: string,
  providedSchool?: Partial<School> | null
): Promise<Partial<School> | null> => {
  if (
    providedSchool &&
    (providedSchool.subscription ||
      (providedSchool as any).isElite !== undefined ||
      (providedSchool as any).isUltra !== undefined)
  ) {
    return providedSchool;
  }

  const cleanSch = String(schoolId || "").trim();
  if (!cleanSch) return providedSchool || null;

  if (typeof window !== "undefined") {
    try {
      const rawList = localStorage.getItem("nst_schools");
      if (rawList) {
        const parsed = JSON.parse(rawList);
        if (Array.isArray(parsed)) {
          const hit = parsed.find((s: any) => s?.id === cleanSch);
          if (hit && (hit.subscription || hit.isElite || hit.isUltra)) return hit;
        }
      }
      const rawSingle = localStorage.getItem(`nst_school_${cleanSch}`);
      if (rawSingle) {
        const parsed = JSON.parse(rawSingle);
        if (parsed && (parsed.subscription || parsed.isElite || parsed.isUltra)) return parsed;
      }
    } catch {}
  }

  if (rtdb) {
    try {
      const snap = await withTimeout(get(ref(rtdb, `schools/${cleanSch}`)), 2200);
      const val = snap?.val?.();
      if (val && typeof val === "object") return { id: cleanSch, ...val };
    } catch {}
  }

  if (db) {
    try {
      const snap = await withTimeout(sbBridgeGetDoc(sbDoc(`schools/${cleanSch}`)), 2200);
      if (snap.exists()) return { id: snap.id, ...(snap.data() as any) };
    } catch {}
  }

  return providedSchool || { id: cleanSch };
};

const readStudentSlotState = async (
  schoolId: string,
  studentId: string
): Promise<{
  record: StudentLinkSlotRecord | null;
  legacyIicUid?: string;
  studentFoundInCloud: boolean;
}> => {
  const cleanSch = cleanSlotRtdbKey(schoolId);
  const cleanStu = cleanSlotRtdbKey(studentId);
  let record: StudentLinkSlotRecord | null = null;
  let legacyIicUid: string | undefined;
  let studentFoundInCloud = false;

  if (rtdb) {
    try {
      const snap = await withTimeout(
        get(ref(rtdb, `schools/${cleanSch}/student_link_slots/${cleanStu}`)),
        2200
      );
      const val = snap?.val?.();
      if (val && typeof val === "object" && Array.isArray(val.slots)) {
        record = val as StudentLinkSlotRecord;
      }
    } catch {}
  }

  if (!record) {
    try {
      const sbVal = await withTimeout(
        sbRtdbGet<StudentLinkSlotRecord>(`schools/${cleanSch}/student_link_slots/${cleanStu}`),
        1800
      );
      if (sbVal && Array.isArray(sbVal.slots)) {
        record = sbVal;
      }
    } catch {}
  }

  if (db) {
    try {
      const stSnap = await withTimeout(
        sbBridgeGetDoc(sbDoc(`schools/${schoolId}/students/${studentId}`)),
        2200
      );
      if (stSnap.exists()) {
        studentFoundInCloud = true;
        const data = stSnap.data() as any;
        if (data?.iicUid) legacyIicUid = String(data.iicUid);
        if (!record && Array.isArray(data?.linkedHolders)) {
          record = {
            studentId,
            schoolId,
            limit: (Number(data.linkLimit) === 4 ? 4 : Number(data.linkLimit) === 2 ? 2 : 1) as 1 | 2 | 4,
            planName: Number(data.linkLimit) === 4 ? "Ultra" : Number(data.linkLimit) === 2 ? "Elite" : "Lite",
            slots: data.linkedHolders,
            updatedAt: data.slotUpdatedAt || new Date().toISOString(),
          };
        }
      }
    } catch {}
  }

  return { record, legacyIicUid, studentFoundInCloud };
};

const pruneSingleEvictedUserCloud = async (
  holderUid: string,
  studentId: string,
  schoolId: string
): Promise<void> => {
  const cleanUid = String(holderUid || "").trim();
  if (!cleanUid || cleanUid === studentId) return;
  const safeUid = cleanSlotRtdbKey(cleanUid);

  const filterOutStudent = (bundle: any) => {
    if (!bundle || !Array.isArray(bundle.students)) return null;
    const nextStudents = bundle.students.filter((st: any) => {
      if (!st) return false;
      const stSch = String(st.schoolId || schoolId || "").trim();
      return !(String(st.id) === studentId && (!schoolId || stSch === schoolId));
    });
    if (nextStudents.length === bundle.students.length) return null;
    const nextActive = nextStudents[0] || null;
    return {
      ...bundle,
      students: nextStudents,
      activeStudentId: nextActive?.id || "",
      activeStudentKey: nextActive
        ? `${nextActive.schoolId || schoolId}__${nextActive.id}`
        : "",
      updatedAt: new Date().toISOString(),
    };
  };

  const tasks: Promise<any>[] = [];

  if (rtdb) {
    tasks.push(
      (async () => {
        try {
          const snap = await withTimeout(get(ref(rtdb, `school_user_links/${safeUid}`)), 2200);
          const updated = filterOutStudent(snap?.val?.());
          if (updated) {
            await withTimeout(set(ref(rtdb, `school_user_links/${safeUid}`), updated), 2200);
          }
        } catch {}
      })(),
      (async () => {
        try {
          const snap = await withTimeout(
            get(ref(rtdb, `users/${safeUid}/linkedSchoolStudents`)),
            2200
          );
          const updated = filterOutStudent(snap?.val?.());
          if (updated) {
            await withTimeout(
              set(ref(rtdb, `users/${safeUid}/linkedSchoolStudents`), updated),
              2200
            );
          }
        } catch {}
      })(),
      (async () => {
        try {
          const snap = await withTimeout(get(ref(rtdb, `school_users/${safeUid}`)), 2200);
          const prof = snap?.val?.();
          if (
            prof &&
            prof.studentRef === studentId &&
            (!schoolId || prof.schoolId === schoolId)
          ) {
            await withTimeout(
              set(ref(rtdb, `school_users/${safeUid}`), {
                ...prof,
                studentRef: "",
                updatedAt: new Date().toISOString(),
              }),
              2200
            );
          }
        } catch {}
      })()
    );
  }

  if (db) {
    tasks.push(
      (async () => {
        try {
          const snap = await withTimeout(
            sbBridgeGetDoc(sbDoc(`school_user_links/${safeUid}`)),
            2200
          );
          if (snap.exists()) {
            const updated = filterOutStudent(snap.data());
            if (updated) {
              await withTimeout(
                sbBridgeSetDoc(sbDoc(`school_user_links/${safeUid}`), updated),
                2200
              );
            }
          }
        } catch {}
      })(),
      (async () => {
        try {
          const snap = await withTimeout(sbBridgeGetDoc(sbDoc(`school_users/${safeUid}`)), 2200);
          if (snap.exists()) {
            const prof = snap.data() as any;
            if (
              prof &&
              prof.studentRef === studentId &&
              (!schoolId || prof.schoolId === schoolId)
            ) {
              await withTimeout(
                sbBridgeSetDoc(
                  sbDoc(`school_users/${safeUid}`),
                  { studentRef: "", updatedAt: new Date().toISOString() },
                  { merge: true }
                ),
                2200
              );
            }
          }
        } catch {}
      })()
    );
  }

  tasks.push(
    (async () => {
      try {
        const sbBundle = await withTimeout(
          sbRtdbGet<any>(`school_user_links/${safeUid}`),
          1800
        );
        const updated = filterOutStudent(sbBundle);
        if (updated) {
          await sbRtdbSet(`school_user_links/${safeUid}`, updated);
        }
      } catch {}
    })()
  );

  await Promise.allSettled(tasks);
};

export const registerStudentIdCardLinkSlot = async (params: {
  schoolId: string;
  studentId: string;
  studentName?: string;
  uid?: string | null;
  school?: Partial<School> | null;
  holderLabel?: string;
  deviceId?: string;
}): Promise<{
  ok: boolean;
  limit: 1 | 2 | 4;
  planName: SchoolPlanTierName;
  slots: StudentIdCardLinkSlot[];
  evicted: StudentIdCardLinkSlot[];
  holder: ReturnType<typeof resolveStudentLinkHolder>;
}> => {
  const schoolId = String(params.schoolId || "").trim();
  const studentId = String(params.studentId || "").trim();
  const holder = resolveStudentLinkHolder({
    uid: params.uid,
    studentId,
    holderLabel: params.holderLabel,
    deviceId: params.deviceId,
  });

  if (!schoolId || !studentId) {
    return {
      ok: false,
      limit: 1,
      planName: "Lite",
      slots: [],
      evicted: [],
      holder,
    };
  }

  await ensureFirebaseAuthSession().catch(() => null);

  const [resolvedSchool, slotState] = await Promise.all([
    fetchSchoolForSlotLimit(schoolId, params.school),
    readStudentSlotState(schoolId, studentId),
  ]);

  const limit = getSchoolStudentAccountLimit(resolvedSchool);
  const planName = getSchoolPlanTierName(resolvedSchool);
  const nowIso = new Date().toISOString();

  let currentSlots: StudentIdCardLinkSlot[] = Array.isArray(slotState.record?.slots)
    ? slotState.record!.slots.filter(
        (s): s is StudentIdCardLinkSlot => Boolean(s && s.holderKey && s.holderUid)
      )
    : [];

  if (
    currentSlots.length === 0 &&
    slotState.legacyIicUid &&
    slotState.legacyIicUid !== studentId
  ) {
    currentSlots = [
      {
        holderKey: cleanSlotRtdbKey(slotState.legacyIicUid),
        holderUid: slotState.legacyIicUid,
        holderLabel: "Previous Account",
        linkedAt: slotState.record?.updatedAt || new Date(0).toISOString(),
      },
    ];
  }

  // Deduplicate existing entry for this exact holderKey or non-direct UID
  const remaining = currentSlots.filter((s) => {
    if (s.holderKey === holder.holderKey) return false;
    if (holder.holderUid !== studentId && s.holderUid === holder.holderUid) return false;
    return true;
  });

  const newSlot: StudentIdCardLinkSlot = {
    holderKey: holder.holderKey,
    holderUid: holder.holderUid,
    deviceId: holder.deviceId,
    holderLabel: holder.holderLabel,
    linkedAt: nowIso,
  };

  const combined = [...remaining, newSlot];
  let evicted: StudentIdCardLinkSlot[] = [];
  let keptSlots = combined;

  if (combined.length > limit) {
    const cutIdx = combined.length - limit;
    evicted = combined.slice(0, cutIdx);
    keptSlots = combined.slice(cutIdx);
  }

  const payload: StudentLinkSlotRecord = {
    studentId,
    schoolId,
    limit,
    planName,
    slots: keptSlots,
    updatedAt: nowIso,
  };

  const cleanSch = cleanSlotRtdbKey(schoolId);
  const cleanStu = cleanSlotRtdbKey(studentId);

  const latestUidHolder =
    keptSlots.find((s) => s.holderUid && s.holderUid !== studentId)?.holderUid ||
    (holder.holderUid !== studentId ? holder.holderUid : undefined);

  const writes: Promise<any>[] = [
    sbRtdbSet(`schools/${cleanSch}/student_link_slots/${cleanStu}`, payload).catch(() => {}),
  ];

  if (rtdb) {
    writes.push(
      withTimeout(
        set(ref(rtdb, `schools/${cleanSch}/student_link_slots/${cleanStu}`), payload),
        2500
      ).catch(() => {})
    );
  }

  if (db) {
    writes.push(
      withTimeout(
        sbBridgeSetDoc(
          sbDoc(`schools/${schoolId}/students/${studentId}`),
          {
            linkedHolders: keptSlots,
            linkLimit: limit,
            slotUpdatedAt: nowIso,
            ...(latestUidHolder ? { iicUid: latestUidHolder } : {}),
          },
          { merge: true }
        ),
        2500
      ).catch(() => {})
    );
  }

  await Promise.allSettled(writes);

  if (evicted.length > 0) {
    await Promise.allSettled(
      evicted.map((ev) => pruneSingleEvictedUserCloud(ev.holderUid, studentId, schoolId))
    );
  }

  return {
    ok: true,
    limit,
    planName,
    slots: keptSlots,
    evicted,
    holder,
  };
};

export const unregisterStudentIdCardLinkSlot = async (params: {
  schoolId: string;
  studentId: string;
  uid?: string | null;
  deviceId?: string;
}): Promise<void> => {
  const schoolId = String(params.schoolId || "").trim();
  const studentId = String(params.studentId || "").trim();
  if (!schoolId || !studentId) return;

  const holder = resolveStudentLinkHolder({
    uid: params.uid,
    studentId,
    deviceId: params.deviceId,
  });

  await ensureFirebaseAuthSession().catch(() => null);
  const { record } = await readStudentSlotState(schoolId, studentId);
  if (!record || !Array.isArray(record.slots)) return;

  const nextSlots = record.slots.filter((s) => {
    if (!s) return false;
    if (s.holderKey === holder.holderKey) return false;
    if (holder.holderUid !== studentId && s.holderUid === holder.holderUid) return false;
    return true;
  });

  if (nextSlots.length === record.slots.length) return;

  const nowIso = new Date().toISOString();
  const nextRecord: StudentLinkSlotRecord = {
    ...record,
    slots: nextSlots,
    updatedAt: nowIso,
  };

  const cleanSch = cleanSlotRtdbKey(schoolId);
  const cleanStu = cleanSlotRtdbKey(studentId);
  const nextPrimaryUid =
    nextSlots.find((s) => s.holderUid && s.holderUid !== studentId)?.holderUid || "";

  await Promise.allSettled([
    sbRtdbSet(`schools/${cleanSch}/student_link_slots/${cleanStu}`, nextRecord).catch(() => {}),
    rtdb
      ? withTimeout(
          set(ref(rtdb, `schools/${cleanSch}/student_link_slots/${cleanStu}`), nextRecord),
          2500
        ).catch(() => {})
      : Promise.resolve(),
    db
      ? withTimeout(
          sbBridgeSetDoc(
            sbDoc(`schools/${schoolId}/students/${studentId}`),
            {
              linkedHolders: nextSlots,
              iicUid: nextPrimaryUid,
              slotUpdatedAt: nowIso,
            },
            { merge: true }
          ),
          2500
        ).catch(() => {})
      : Promise.resolve(),
  ]);
};

export const isHolderDisplacedBySlotRecord = (
  record: StudentLinkSlotRecord | null | undefined,
  uid: string,
  studentId: string,
  deviceId?: string
): boolean => {
  if (!record || !Array.isArray(record.slots) || record.slots.length === 0) {
    return false;
  }
  const holder = resolveStudentLinkHolder({ uid, studentId, deviceId });
  const stillLinked = record.slots.some(
    (s) =>
      s &&
      (s.holderKey === holder.holderKey ||
        (holder.holderUid !== studentId && s.holderUid === holder.holderUid))
  );
  return !stillLinked;
};

export const checkLinkedStudentsSlotValidity = async (params: {
  uid: string;
  students: any[];
  defaultSchoolId: string;
}): Promise<{
  activeStudents: any[];
  displacedStudents: any[];
  verifiedAny: boolean;
}> => {
  const input = Array.isArray(params.students) ? params.students.filter(Boolean) : [];
  if (input.length === 0 || !params.uid) {
    return { activeStudents: input, displacedStudents: [], verifiedAny: false };
  }

  await ensureFirebaseAuthSession().catch(() => null);
  const activeStudents: any[] = [];
  const displacedStudents: any[] = [];
  let verifiedAny = false;

  await Promise.all(
    input.map(async (st) => {
      const schId = String(st.schoolId || params.defaultSchoolId || "").trim();
      const stId = String(st.id || "").trim();
      if (!schId || !stId) {
        activeStudents.push(st);
        return;
      }
      try {
        const { record } = await readStudentSlotState(schId, stId);
        if (record && Array.isArray(record.slots) && record.slots.length > 0) {
          verifiedAny = true;
          if (isHolderDisplacedBySlotRecord(record, params.uid, stId)) {
            displacedStudents.push(st);
            return;
          }
        }
      } catch {}
      activeStudents.push(st);
    })
  );

  return { activeStudents, displacedStudents, verifiedAny };
};

export const subscribeToStudentLinkSlots = (params: {
  uid: string;
  students: any[];
  defaultSchoolId: string;
  onDisplaced: (student: any, record: StudentLinkSlotRecord) => void;
}): (() => void) => {
  if (!rtdb || !params.uid || !Array.isArray(params.students) || params.students.length === 0) {
    return () => {};
  }

  const unsubs: Array<() => void> = [];
  const seenTargets = new Set<string>();

  for (const st of params.students) {
    if (!st?.id) continue;
    const schId = String(st.schoolId || params.defaultSchoolId || "").trim();
    const stId = String(st.id || "").trim();
    if (!schId || !stId) continue;

    const dedupeKey = `${schId}__${stId}`;
    if (seenTargets.has(dedupeKey)) continue;
    seenTargets.add(dedupeKey);

    const slotRef = ref(
      rtdb,
      `schools/${cleanSlotRtdbKey(schId)}/student_link_slots/${cleanSlotRtdbKey(stId)}`
    );
    const unsub = onValue(
      slotRef,
      (snap) => {
        const val = snap?.val?.() as StudentLinkSlotRecord | null;
        if (!val || !Array.isArray(val.slots) || val.slots.length === 0) return;
        if (isHolderDisplacedBySlotRecord(val, params.uid, stId)) {
          params.onDisplaced(st, val);
        }
      },
      () => {}
    );
    unsubs.push(unsub);
  }

  return () => {
    unsubs.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
};
