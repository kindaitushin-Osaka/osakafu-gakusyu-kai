// =================================================================
// index.html 修正パッチ ― スケジュール・FAQ Firebase連携
// =================================================================
// 以下の手順で修正してください。
//
// 【手順1】window公開に2行追加（renderAll()の直前）
// 【手順2】addSchedule() を置き換え
// 【手順3】deleteSchedule() を置き換え
// 【手順4】joinSchedule() を置き換え
// 【手順5】addFaq() を置き換え
// 【手順6】deleteFaq() を置き換え
// =================================================================


// ----------------------------------------------------------------
// 【手順1】renderAll() の直前にある window 公開部分に2行追加
// ----------------------------------------------------------------
//
// 現在こうなっているはず：
//   window.data = data;
//   window.renderBoard = renderBoard;
//   window.renderNotices = renderNotices;
//   window.renderMembers = renderMembers;
//   renderAll();
//
// ↓ 以下2行を追加する
//   window.renderSchedules = renderSchedules;  ← 追加
//   window.renderSideEvents = renderSideEvents; ← 追加
//   window.renderFaq = renderFaq;              ← 追加
//   renderAll();


// ----------------------------------------------------------------
// 【手順2】addSchedule() を丸ごと置き換え
// ----------------------------------------------------------------

function addSchedule() {
  const date  = document.getElementById("adminScheduleDate").value;
  const title = document.getElementById("adminScheduleTitle").value.trim();
  if (!date || !title) return alert("日付とタイトルを入力してください");

  const schedule = {
    date,
    title,
    place : document.getElementById("adminSchedulePlace").value.trim(),
    type  : document.getElementById("adminScheduleType").value,
    participants: 0,
    joined: false
  };

  data.schedules.push(schedule);

  // Firestore へ保存
  if (typeof window.firebaseSaveSchedule === "function") {
    window.firebaseSaveSchedule(schedule);
  }

  ["adminScheduleDate","adminScheduleTitle","adminSchedulePlace"]
    .forEach(id => document.getElementById(id).value = "");

  saveData();
  renderAdminLists();
}


// ----------------------------------------------------------------
// 【手順3】deleteSchedule() を丸ごと置き換え
// ----------------------------------------------------------------

function deleteSchedule(i) {
  // Firestore から削除
  if (typeof window.firebaseDeleteSchedule === "function") {
    window.firebaseDeleteSchedule(i);
  }
  data.schedules.splice(i, 1);
  saveData();
  renderAdminLists();
}


// ----------------------------------------------------------------
// 【手順4】joinSchedule() を丸ごと置き換え
// ----------------------------------------------------------------

function joinSchedule(i) {
  if (data.schedules[i].joined) return;
  data.schedules[i].participants++;
  data.schedules[i].joined = true;

  // Firestore の参加人数を+1
  if (typeof window.firebaseJoinSchedule === "function") {
    window.firebaseJoinSchedule(i);
  }

  saveData();
}


// ----------------------------------------------------------------
// 【手順5】addFaq() を丸ごと置き換え
// ----------------------------------------------------------------

function addFaq() {
  const q = document.getElementById("adminFaqQuestion").value.trim();
  const a = document.getElementById("adminFaqAnswer").value.trim();
  if (!q || !a) return alert("質問と回答を入力してください");

  const faq = {
    category: document.getElementById("adminFaqCategory").value,
    q,
    a
  };

  data.faqs.push(faq);

  // Firestore へ保存
  if (typeof window.firebaseSaveFaq === "function") {
    window.firebaseSaveFaq(faq);
  }

  ["adminFaqQuestion","adminFaqAnswer"]
    .forEach(id => document.getElementById(id).value = "");

  saveData();
  renderAdminLists();
}


// ----------------------------------------------------------------
// 【手順6】deleteFaq() を丸ごと置き換え
// ----------------------------------------------------------------

function deleteFaq(i) {
  // Firestore から削除
  if (typeof window.firebaseDeleteFaq === "function") {
    window.firebaseDeleteFaq(i);
  }
  data.faqs.splice(i, 1);
  saveData();
  renderAdminLists();
}
