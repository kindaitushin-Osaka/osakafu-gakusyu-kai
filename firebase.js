// ============================================================
// firebase.js  ―  完成版（近大メール＋合言葉ログイン対応・設定Firebase同期）
// ============================================================

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  increment,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getAnalytics }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// ── Firebase 設定 ─────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyA_0qj3n_4eoARjDTO1jdWRXmYNE7HZRrk",
  authDomain:        "osaka-info-gakusyukai.firebaseapp.com",
  projectId:         "osaka-info-gakusyukai",
  storageBucket:     "osaka-info-gakusyukai.firebasestorage.app",
  messagingSenderId: "222261320673",
  appId:             "1:222261320673:web:896e9b0eea9d074d7990a0",
  measurementId:     "G-DFJ1VJVVD2"
};

const app       = initializeApp(firebaseConfig);
const db        = getFirestore(app);
const analytics = getAnalytics(app);
console.log("Firebase 接続OK");

// ── docId マップ（ローカルインデックス ↔ FirestoreドキュメントID） ──────
let boardIdMap    = {};
let noticeIdMap   = {};
let memberIdMap   = {};
let scheduleIdMap = {};
let faqIdMap      = {};

// ── 日時フォーマット ───────────────────────────────────────
function formatDateTime(timestamp) {
  if (!timestamp) return "";
  const d  = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  const h  = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${dy} ${h}:${mi}`;
}

// ============================================================
// 【Firestoreリスナー開始】
// index.html の checkPassword() 成功後 または ページ再読み込み時に呼ばれる
// ============================================================

window.startFirestoreListeners = function () {
  initBoardListener();
  initNoticeListener();
  initMemberListener();
  initScheduleListener();
  initFaqListener();
  initSettingsListener();
  console.log("Firestoreリスナー全開始");
};

// ページ読み込み時、すでにログイン済みなら自動でFirestoreリスナー開始
window.addEventListener("load", () => {
  const access = localStorage.getItem("siteAccess");
  const email  = localStorage.getItem("kindaiEmail");
  if (access === "ok" && email && email.endsWith("@kindai.ac.jp")) {
    setTimeout(() => {
      window.startFirestoreListeners();
    }, 600);
  }
});

// ============================================================
// 【掲示板】
// ============================================================

window.firebaseSaveBoardPost = async function (post) {
  try {
    await addDoc(collection(db, "boardPosts"), {
      category : post.category,
      title    : post.title,
      body     : post.body,
      author   : post.author,
      likes    : 0,
      solved   : false,
      stamps   : post.stamps,
      created  : serverTimestamp()
    });
    console.log("掲示板投稿保存OK");
  } catch (err) {
    console.error("掲示板投稿保存失敗:", err);
  }
};

window.firebaseLikePost = async function (localIndex) {
  const docId = boardIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "boardPosts", docId), { likes: increment(1) });
    console.log("いいね更新OK");
  } catch (err) {
    console.error("いいね更新失敗:", err);
  }
};

window.firebaseStampPost = async function (localIndex, stampKey) {
  const docId = boardIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "boardPosts", docId), {
      [`stamps.${stampKey}`]: increment(1)
    });
    console.log("スタンプ更新OK:", stampKey);
  } catch (err) {
    console.error("スタンプ更新失敗:", err);
  }
};

window.firebaseToggleSolved = async function (localIndex, newValue) {
  const docId = boardIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "boardPosts", docId), { solved: newValue });
    console.log("解決済み更新OK:", newValue);
  } catch (err) {
    console.error("解決済み更新失敗:", err);
  }
};

window.firebaseAddReply = async function (localIndex, replyText) {
  const docId = boardIdMap[localIndex];
  if (!docId) return;
  try {
    await addDoc(
      collection(db, "boardPosts", docId, "replies"),
      { text: replyText, created: serverTimestamp() }
    );
    console.log("返信保存OK");
  } catch (err) {
    console.error("返信保存失敗:", err);
  }
};

async function initBoardListener() {
  const q = query(collection(db, "boardPosts"), orderBy("created", "desc"));
  onSnapshot(q, async (snapshot) => {
    const posts = [];
    boardIdMap = {};
    for (let i = 0; i < snapshot.docs.length; i++) {
      const d   = snapshot.docs[i];
      const raw = d.data();
      let replies = [];
      try {
        const rSnap = await getDocs(
          query(collection(db, "boardPosts", d.id, "replies"), orderBy("created", "asc"))
        );
        replies = rSnap.docs.map(r => ({
          text    : r.data().text,
          created : formatDateTime(r.data().created)
        }));
      } catch (_) {}
      posts.push({
        category : raw.category || "質問",
        title    : raw.title    || "",
        body     : raw.body     || "",
        author   : raw.author   || "匿名",
        likes    : raw.likes    || 0,
        solved   : raw.solved   || false,
        stamps   : raw.stamps   || { "❤":0,"👍":0,"😊":0,"🎉":0,"💪":0 },
        replies  : replies,
        created  : formatDateTime(raw.created)
      });
      boardIdMap[i] = d.id;
    }
    if (window.data && window.renderBoard) {
      window.data.boardPosts = posts;
      window.renderBoard();
      console.log(`掲示板を同期: ${posts.length}件`);
    }
  }, (err) => console.error("掲示板onSnapshotエラー:", err));
}

// ============================================================
// 【お知らせ】
// ============================================================

window.firebaseSaveNotice = async function (notice) {
  try {
    await addDoc(collection(db, "notices"), {
      title    : notice.title,
      body     : notice.body,
      type     : notice.type,
      pinned   : notice.pinned,
      formUrl  : notice.formUrl  || "",
      created  : notice.created  || "",
      createdAt: serverTimestamp()
    });
    console.log("お知らせ保存OK");
  } catch (err) {
    console.error("お知らせ保存失敗:", err);
  }
};

window.firebaseDeleteNotice = async function (localIndex) {
  const docId = noticeIdMap[localIndex];
  if (!docId) { console.warn("お知らせdocId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "notices", docId));
    console.log("お知らせ削除OK");
  } catch (err) {
    console.error("お知らせ削除失敗:", err);
  }
};

window.firebaseUpdateNotice = async function (localIndex, updatedData) {
  const docId = noticeIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "notices", docId), updatedData);
    console.log("お知らせ更新OK");
  } catch (err) {
    console.error("お知らせ更新失敗:", err);
  }
};

function initNoticeListener() {
  const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const notices = [];
    noticeIdMap = {};
    snapshot.docs.forEach((d, i) => {
      const raw = d.data();
      notices.push({
        title   : raw.title   || "",
        body    : raw.body    || "",
        type    : raw.type    || "お知らせ",
        pinned  : raw.pinned  || false,
        formUrl : raw.formUrl || "",
        created : raw.created || ""
      });
      noticeIdMap[i] = d.id;
    });
    if (window.data && window.renderNotices) {
      window.data.notices = notices;
      window.renderNotices();
      console.log(`お知らせを同期: ${notices.length}件`);
    }
  }, (err) => console.error("お知らせonSnapshotエラー:", err));
}

// ============================================================
// 【メンバー】
// ============================================================

window.firebaseSaveMember = async function (member) {
  try {
    await addDoc(collection(db, "members"), {
      name      : member.name,
      icon      : member.icon    || "👤",
      comment   : member.comment || "",
      subject   : member.subject || "",
      style     : member.style   || "",
      grade     : member.grade   || "",
      createdAt : serverTimestamp()
    });
    console.log("メンバー保存OK");
  } catch (err) {
    console.error("メンバー保存失敗:", err);
  }
};

window.firebaseDeleteMember = async function (localIndex) {
  const docId = memberIdMap[localIndex];
  if (!docId) { console.warn("メンバーdocId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "members", docId));
    console.log("メンバー削除OK");
  } catch (err) {
    console.error("メンバー削除失敗:", err);
  }
};

window.firebaseUpdateMember = async function (localIndex, updatedData) {
  const docId = memberIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "members", docId), updatedData);
    console.log("メンバー更新OK");
  } catch (err) {
    console.error("メンバー更新失敗:", err);
  }
};

function initMemberListener() {
  const q = query(collection(db, "members"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const members = [];
    memberIdMap = {};
    snapshot.docs.forEach((d, i) => {
      const raw = d.data();
      members.push({
        name    : raw.name    || "",
        icon    : raw.icon    || "👤",
        comment : raw.comment || "",
        subject : raw.subject || "",
        style   : raw.style   || "",
        grade   : raw.grade   || ""
      });
      memberIdMap[i] = d.id;
    });
    if (window.data && window.renderMembers) {
      window.data.members = members;
      window.renderMembers();
      console.log(`メンバーを同期: ${members.length}件`);
    }
  }, (err) => console.error("メンバーonSnapshotエラー:", err));
}

// ============================================================
// 【スケジュール】
// ============================================================

window.firebaseSaveSchedule = async function (schedule) {
  try {
    await addDoc(collection(db, "schedules"), {
      date        : schedule.date,
      title       : schedule.title,
      place       : schedule.place  || "",
      type        : schedule.type   || "勉強会",
      participants: 0,
      createdAt   : serverTimestamp()
    });
    console.log("スケジュール保存OK");
  } catch (err) {
    console.error("スケジュール保存失敗:", err);
  }
};

window.firebaseDeleteSchedule = async function (localIndex) {
  const docId = scheduleIdMap[localIndex];
  if (!docId) { console.warn("スケジュールdocId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "schedules", docId));
    console.log("スケジュール削除OK");
  } catch (err) {
    console.error("スケジュール削除失敗:", err);
  }
};

window.firebaseUpdateSchedule = async function (localIndex, updatedData) {
  const docId = scheduleIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "schedules", docId), updatedData);
    console.log("スケジュール更新OK");
  } catch (err) {
    console.error("スケジュール更新失敗:", err);
  }
};

window.firebaseJoinSchedule = async function (localIndex) {
  const docId = scheduleIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "schedules", docId), { participants: increment(1) });
    console.log("参加登録OK");
  } catch (err) {
    console.error("参加登録失敗:", err);
  }
};

function initScheduleListener() {
  const q = query(collection(db, "schedules"), orderBy("date", "asc"));
  onSnapshot(q, (snapshot) => {
    const schedules = [];
    scheduleIdMap = {};
    snapshot.docs.forEach((d, i) => {
      const raw = d.data();
      schedules.push({
        date        : raw.date         || "",
        title       : raw.title        || "",
        place       : raw.place        || "",
        type        : raw.type         || "勉強会",
        participants: raw.participants  || 0,
        joined      : false
      });
      scheduleIdMap[i] = d.id;
    });
    if (window.data && window.renderSchedules) {
      const prevJoined = (window.data.schedules || []).map(s => s.joined);
      schedules.forEach((s, i) => { s.joined = prevJoined[i] || false; });
      window.data.schedules = schedules;
      window.renderSchedules();
      window.renderSideEvents();
      console.log(`スケジュールを同期: ${schedules.length}件`);
    }
  }, (err) => console.error("スケジュールonSnapshotエラー:", err));
}

// ============================================================
// 【FAQ】
// ============================================================

window.firebaseSaveFaq = async function (faq) {
  try {
    await addDoc(collection(db, "faqs"), {
      category  : faq.category || "履修",
      q         : faq.q        || "",
      a         : faq.a        || "",
      createdAt : serverTimestamp()
    });
    console.log("FAQ保存OK");
  } catch (err) {
    console.error("FAQ保存失敗:", err);
  }
};

window.firebaseUpdateFaq = async function (localIndex, updatedData) {
  const docId = faqIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "faqs", docId), updatedData);
    console.log("FAQ更新OK");
  } catch (err) {
    console.error("FAQ更新失敗:", err);
  }
};

window.firebaseDeleteFaq = async function (localIndex) {
  const docId = faqIdMap[localIndex];
  if (!docId) { console.warn("FAQdocId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "faqs", docId));
    console.log("FAQ削除OK");
  } catch (err) {
    console.error("FAQ削除失敗:", err);
  }
};

function initFaqListener() {
  const q = query(collection(db, "faqs"), orderBy("createdAt", "asc"));
  onSnapshot(q, (snapshot) => {
    const faqs = [];
    faqIdMap = {};
    snapshot.docs.forEach((d, i) => {
      const raw = d.data();
      faqs.push({
        category : raw.category || "履修",
        q        : raw.q        || "",
        a        : raw.a        || ""
      });
      faqIdMap[i] = d.id;
    });
    if (window.data && window.renderFaq) {
      window.data.faqs = faqs;
      window.renderFaq();
      console.log(`FAQを同期: ${faqs.length}件`);
    }
  }, (err) => console.error("FAQonSnapshotエラー:", err));
}

// ============================================================
// 【設定】Firestore同期（③ 設定のリアルタイム同期）
// ============================================================

window.firebaseSaveSettings = async function (settings) {
  try {
    await setDoc(doc(db, "settings", "main"), {
      driveUrl     : settings.driveUrl     || "#",
      driveDesc    : settings.driveDesc    || "",
      contactEmail : settings.contactEmail || "",
      contactTel   : settings.contactTel   || "",
      contactHours : settings.contactHours || ""
    });
    console.log("設定保存OK（Firestore）");
  } catch (err) {
    console.error("設定保存失敗:", err);
  }
};

function initSettingsListener() {
  onSnapshot(doc(db, "settings", "main"), (snap) => {
    if (!snap.exists()) {
      console.log("settings/main がまだありません（管理ページから保存してください）");
      return;
    }
    const raw = snap.data();
    if (window.data) {
      window.data.settings = {
        driveUrl     : raw.driveUrl     || "#",
        driveDesc    : raw.driveDesc    || "",
        contactEmail : raw.contactEmail || "",
        contactTel   : raw.contactTel   || "",
        contactHours : raw.contactHours || ""
      };
      if (window.renderMaterials) window.renderMaterials();
      if (window.renderContact)   window.renderContact();
      console.log("設定を同期しました");
    }
  }, (err) => console.error("設定onSnapshotエラー:", err));
}

console.log("firebase.js 読込OK");
