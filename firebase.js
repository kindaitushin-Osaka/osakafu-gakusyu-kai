// ============================================================
// firebase.js  ―  最終完全版（投稿日時・返信日時追加） 
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
  onSnapshot,
  query,
  orderBy,
  increment,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getAuth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const auth      = getAuth(app);
const analytics = getAnalytics(app);
console.log("Firebase 接続OK");

// ── docId マップ ───────────────────────────────────────────
let boardIdMap    = {};
let noticeIdMap   = {};
let memberIdMap   = {};
let scheduleIdMap = {};
let faqIdMap      = {};

// ── 日時フォーマット ───────────────────────────────────────
function formatDateTime(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${day} ${h}:${mi}`;
}

// ============================================================
// 【メールリンク認証】
// ============================================================

const ACTION_CODE_SETTINGS = {
  url: "https://kindaitushin-osaka.github.io/osakafu-gakusyu-kai/",
  handleCodeInApp: true
};

const ALLOWED_DOMAIN = "kindai.ac.jp";

window.firebaseSendEmailLink = async function (email) {
  if (!email.endsWith("@" + ALLOWED_DOMAIN)) {
    alert("近畿大学のメールアドレス（@kindai.ac.jp）のみ利用できます。");
    return false;
  }
  try {
    await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
    localStorage.setItem("emailForSignIn", email);
    console.log("メールリンク送信OK");
    return true;
  } catch (err) {
    console.error("メールリンク送信失敗:", err);
    alert("メールの送信に失敗しました。もう一度お試しください。");
    return false;
  }
};

window.firebaseSignOut = async function () {
  try {
    await signOut(auth);
    localStorage.removeItem("emailForSignIn");
    localStorage.removeItem("siteAccess");
    location.reload();
  } catch (err) {
    console.error("ログアウト失敗:", err);
  }
};

async function handleEmailLinkSignIn() {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = localStorage.getItem("emailForSignIn");
    if (!email) {
      email = prompt("確認のためメールアドレスを入力してください");
    }
    try {
      await signInWithEmailLink(auth, email, window.location.href);
      localStorage.removeItem("emailForSignIn");
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log("メールリンク認証成功");
    } catch (err) {
      console.error("メールリンク認証失敗:", err);
      alert("認証に失敗しました。もう一度メールアドレスを入力してください。");
    }
  }
}

window.addEventListener("load", () => {
  handleEmailLinkSignIn().catch(e => {
    console.error("handleEmailLinkSignIn失敗:", e);
  });

  console.log("onAuthStateChanged開始");
  onAuthStateChanged(auth, (user) => {
    console.log("onAuthStateChangedコールバック:", user ? user.email : "未ログイン");
    if (user) {
      console.log("ログイン中:", user.email);
      const emailDisplay = document.getElementById("userEmailDisplay");
      if (emailDisplay) emailDisplay.textContent = user.email;
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) logoutBtn.style.display = "inline-flex";
      const overlay = document.getElementById("authOverlay");
      if (overlay) overlay.style.display = "none";
      setTimeout(() => {
        initBoardListener();
        initNoticeListener();
        initMemberListener();
        initScheduleListener();
        initFaqListener();
      }, 1000);
} else {
      console.log("未ログイン処理開始");
      // ローカル環境の場合は認証スキップ
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        console.log("ローカル環境のため認証スキップ");
        setTimeout(() => {
          initBoardListener();
          initNoticeListener();
          initMemberListener();
          initScheduleListener();
          initFaqListener();
        }, 1000);
        return;
      }
      // 本番環境は認証画面を表示
      const overlay = document.getElementById("authOverlay");
      if (overlay) {
        overlay.style.display = "flex";
        console.log("authOverlay表示設定完了");
      } else {
        console.log("authOverlayが見つかりません！");
      }
    }
  });
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
      created  : serverTimestamp()  // 投稿日時
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

// 返信の追加（返信日時も保存）
window.firebaseAddReply = async function (localIndex, replyText) {
  const docId = boardIdMap[localIndex];
  if (!docId) return;
  try {
    await addDoc(
      collection(db, "boardPosts", docId, "replies"),
      {
        text    : replyText,
        created : serverTimestamp()  // 返信日時
      }
    );
    console.log("返信保存OK");
  } catch (err) {
    console.error("返信保存失敗:", err);
  }
};

// 掲示板リアルタイム監視（投稿日時・返信日時を取得）
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
        // 返信日時も取得
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
        created  : formatDateTime(raw.created)  // 投稿日時
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
      formUrl  : notice.formUrl || "",
      created  : notice.created || "",
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
      name     : member.name,
      icon     : member.icon    || "👤",
      comment  : member.comment || "",
      subject  : member.subject || "",
      style    : member.style   || "",
      grade    : member.grade   || "",
      createdAt: serverTimestamp()
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

window.firebaseJoinSchedule = async function (localIndex) {
  const docId = scheduleIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "schedules", docId), {
      participants: increment(1)
    });
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
        participants: raw.participants || 0,
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

console.log("firebase.js 読込OK");
