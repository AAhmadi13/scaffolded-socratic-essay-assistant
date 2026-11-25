document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "socraticcanvas.v1";

  const authScreen = document.getElementById("authScreen");
  const libraryScreen = document.getElementById("libraryScreen");
  const libraryResize = document.getElementById("libraryResize");
  const editorScreen = document.getElementById("editorScreen");
  const editorBody = document.querySelector(".editor-body");
  const editedLabel = document.getElementById("editedLabel");
  const authForm = document.getElementById("authForm");
  const authUsername = document.getElementById("authUsername");
  const authPassword = document.getElementById("authPassword");
  const authError = document.getElementById("authError");
  const authSubmit = document.getElementById("authSubmit");
  const showLoginBtn = document.getElementById("showLoginBtn");
  const showSignupBtn = document.getElementById("showSignupBtn");
  const libraryTitle = document.getElementById("libraryTitle");
  const librarySubtitle = document.getElementById("librarySubtitle");
  const libraryEmpty = document.getElementById("libraryEmpty");
  const libraryMain = document.getElementById("libraryMain");
  const docGrid = document.getElementById("docGrid");
  const emptyTrashBtn = document.getElementById("emptyTrashBtn");
  const trashCount = document.getElementById("trashCount");
  const userTitle = document.getElementById("userTitle");
  const logoutBtn = document.getElementById("logoutBtn");

  const editorCanvas = document.getElementById("editorCanvas");
  const editorScroll = document.getElementById("editorScroll");
  const editorResize = document.getElementById("editorResize");
  const canvasWrapper = document.getElementById("canvasWrapper");
  const leftSidebar = document.getElementById("leftSidebar");
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const sidebarReopenBtn = document.getElementById("sidebarReopenBtn");
  const homeBtn = document.getElementById("homeBtn");
  const outlineList = document.getElementById("outlineList");
  const popoverText = document.getElementById("popoverText");
  const floatingToolbar = document.getElementById("floatingToolbar");
  const aaMenuBtn = document.getElementById("aaMenuBtn");
  const aaPopover = document.getElementById("aaPopover");
  const wordCountLabel = document.getElementById("wordCountLabel");
  const charCountLabel = document.getElementById("charCountLabel");
  const readTimeLabel = document.getElementById("readTimeLabel");
  const getHintBtn = document.getElementById("getHintBtn");
  const socraticPopover = document.getElementById("socraticPopover");
  const closePopoverBtn = document.getElementById("closePopoverBtn");
  const contextMenu = document.getElementById("contextMenu");

  let state = loadState();
  let authMode = "login";
  let libraryView = "home";
  let currentDocId = null;
  let typingTimer = null;
  let saveTimer = null;
  let greetTimer = null;
  let lastActiveBlock = null;
  let toolbarOpen = false;

  applyAppearance();
  applyLibraryWidth(state.libraryWidth || 232);
  if (state.session && state.users.some((user) => user.username === state.session)) {
    ensureLibrary();
    openLibrary("home");
  } else {
    state.session = null;
    showScreen("auth");
  }

  showLoginBtn.addEventListener("click", () => setAuthMode("login"));
  showSignupBtn.addEventListener("click", () => setAuthMode("signup"));

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = authUsername.value.trim();
    const password = authPassword.value;
    authError.textContent = "";

    if (username.length < 2) {
      authError.textContent = "Username must be at least 2 characters.";
      return;
    }
    if (!password) {
      authError.textContent = "Enter a password.";
      return;
    }

    if (authMode === "signup") {
      const taken = state.users.some((user) => user.username.toLowerCase() === username.toLowerCase());
      if (taken) {
        authError.textContent = "That username is already taken.";
        return;
      }
      state.users.push({ username, password });
      state.libraries[username] = { documents: [] };
      state.session = username;
      saveNow();
      openLibrary("home", true);
      return;
    }

    const user = state.users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      authError.textContent = "No account with that username.";
      return;
    }
    if (user.password !== password) {
      authError.textContent = "Incorrect password.";
      return;
    }
    state.session = user.username;
    ensureLibrary();
    saveNow();
    openLibrary("home", true);
  });

  document.querySelectorAll(".lib-nav-btn[data-library-view]").forEach((btn) => {
    btn.addEventListener("click", () => openLibrary(btn.dataset.libraryView));
  });

  emptyTrashBtn.addEventListener("click", () => {
    const count = allDocuments().filter((doc) => doc.trashed).length;
    if (!count) return;
    if (!window.confirm("Delete everything in trash forever?")) return;
    const lib = library();
    lib.documents = lib.documents.filter((doc) => !doc.trashed);
    saveNow();
    renderLibrary();
  });

  logoutBtn.addEventListener("click", () => {
    if (editorScreen.classList.contains("active")) writeCanvasIntoCurrentDocument();
    state.session = null;
    currentDocId = null;
    saveNow();
    authForm.reset();
    authError.textContent = "";
    setAuthMode("login");
    showScreen("auth");
    authUsername.focus();
  });

  homeBtn.addEventListener("click", () => openLibrary("home"));

  editorCanvas.addEventListener("input", () => {
    document.body.classList.add("is-typing");
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      document.body.classList.remove("is-typing");
    }, 1200);

    handleMarkdownShortcuts();
    writeCanvasIntoCurrentDocument();
    updateMetricsAndOutline();
    scheduleSave();
  });

  editorCanvas.addEventListener("keyup", () => {
    rememberHintRange();
    updateActiveBlock();
    syncOutlineToCaret();
  });
  editorCanvas.addEventListener("mouseup", rememberHintRange);
  editorCanvas.addEventListener("click", () => {
    rememberHintRange();
    updateActiveBlock();
    syncOutlineToCaret();
  });

  function toggleSidebar() {
    leftSidebar.classList.toggle("collapsed");
    const open = !leftSidebar.classList.contains("collapsed");
    editorScreen.classList.toggle("sidebar-collapsed", !open);
    leftSidebar.setAttribute("aria-hidden", open ? "false" : "true");
    sidebarToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
    sidebarReopenBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  sidebarToggleBtn.addEventListener("click", toggleSidebar);
  sidebarReopenBtn.addEventListener("click", toggleSidebar);

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
      if (!editorScreen.classList.contains("active")) return;
      event.preventDefault();
      toggleSidebar();
    }
    if (event.key === "Escape") {
      closeMenu();
      socraticPopover.classList.add("hidden");
      hideToolbar();
      aaPopover.classList.add("hidden");
      editorCanvas.querySelectorAll(".flagged-sentence").forEach((el) => el.classList.remove("flagged-sentence"));
    }
  });

  function caretRect() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.anchorNode) return null;
    if (!editorCanvas.contains(selection.anchorNode)) return null;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const offset = range.startOffset;

    if (range.collapsed && node.nodeType === Node.TEXT_NODE && offset > 0) {
      const pre = document.createRange();
      pre.setStart(node, offset - 1);
      pre.setEnd(node, offset);
      const last = pre.getClientRects()[0];
      if (last && last.height > 0 && last.height < 80) {
        return { x: last.right, top: last.top, bottom: last.bottom };
      }
    }

    const direct = range.getClientRects()[0] || range.getBoundingClientRect();
    if (direct && direct.height > 0 && direct.height < 80) {
      const x = range.collapsed || direct.width < 8 ? direct.left : direct.right;
      return { x, top: direct.top, bottom: direct.bottom };
    }

    const block = blockForNode(node);
    if (!block) return null;
    const box = block.getBoundingClientRect();
    return { x: box.left, top: box.top, bottom: box.top + Math.min(box.height, 32) };
  }

  function hideToolbar() {
    toolbarOpen = false;
    floatingToolbar.classList.add("hidden");
  }

  function showToolbarAt(x, y) {
    floatingToolbar.classList.remove("hidden");
    const barWidth = floatingToolbar.offsetWidth;
    const barHeight = floatingToolbar.offsetHeight;
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    const placeAbove = y + barHeight + 10 > viewHeight && y > barHeight + 10;
    floatingToolbar.classList.toggle("above", placeAbove);
    floatingToolbar.style.left = `${Math.max(8, Math.min(x, viewWidth - barWidth - 8))}px`;
    floatingToolbar.style.top = `${y}px`;
  }

  function setCaretRange(range) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  let pendingCaret = null;

  function rememberCaret(range) {
    pendingCaret = range.cloneRange();
    setCaretRange(range);
    editorCanvas.focus();
  }

  function collapsedIn(block, atStart) {
    const range = document.createRange();
    range.selectNodeContents(block);
    range.collapse(atStart);
    return range;
  }

  function pageLines() {
    const lines = [];
    [...editorCanvas.children].forEach((block) => {
      if (block === socraticPopover || block.nodeType !== 1) return;
      const range = document.createRange();
      range.selectNodeContents(block);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      if (rects.length) {
        rects.forEach((rect) => lines.push({ rect, block }));
        return;
      }
      const box = block.getBoundingClientRect();
      if (box.height > 0) lines.push({ rect: box, block });
    });
    return lines;
  }

  function caretOnLine(block, lineRect, clientX) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let best = null;
    let node = walker.nextNode();
    while (node) {
      const length = node.textContent.length;
      for (let index = 0; index <= length; index += 1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.collapse(true);
        const rect = range.getClientRects()[0] || range.getBoundingClientRect();
        if (!rect || rect.height === 0) continue;
        if (rect.bottom < lineRect.top - 3 || rect.top > lineRect.bottom + 3) continue;
        const distance = Math.abs(rect.left - clientX);
        if (!best || distance < best.distance) best = { range, distance };
      }
      node = walker.nextNode();
    }
    if (best) return best.range;
    return collapsedIn(block, clientX < lineRect.left);
  }

  function placeCaretOnPage(clientX, clientY) {
    const lines = pageLines();
    if (!lines.length) {
      rememberCaret(collapsedIn(editorCanvas, true));
      return;
    }
    const first = lines[0];
    const last = lines[lines.length - 1];
    if (clientY < first.rect.top) {
      rememberCaret(collapsedIn(first.block, true));
      return;
    }
    if (clientY > last.rect.bottom) {
      rememberCaret(collapsedIn(last.block, false));
      return;
    }
    let line = null;
    let nearest = Infinity;
    lines.forEach((item) => {
      const distance = clientY < item.rect.top
        ? item.rect.top - clientY
        : clientY > item.rect.bottom
          ? clientY - item.rect.bottom
          : 0;
      if (distance < nearest) {
        nearest = distance;
        line = item;
      }
    });
    rememberCaret(caretOnLine(line.block, line.rect, clientX));
  }

  function linePoint(clientX, clientY) {
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom);
    const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    return { x: clientX / scale, y: clientY / scale };
  }

  function clickLandsOnGlyph(clientX, clientY) {
    const point = linePoint(clientX, clientY);
    return pageLines().some((line) => (
      point.y >= line.rect.top &&
      point.y <= line.rect.bottom &&
      point.x >= line.rect.left &&
      point.x <= line.rect.right
    ));
  }

  editorScroll.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
    if (!target || target.closest("button, a, #socraticPopover, #floatingToolbar, .top-chrome")) return;
    if (clickLandsOnGlyph(event.clientX, event.clientY)) return;
    event.preventDefault();
    const point = linePoint(event.clientX, event.clientY);
    placeCaretOnPage(point.x, point.y);
    updateActiveBlock();
  });

  editorScroll.addEventListener("mouseup", () => {
    if (!pendingCaret) return;
    setCaretRange(pendingCaret);
    editorCanvas.focus();
    pendingCaret = null;
  });

  function openToolbarAtClick(event) {
    event.preventDefault();
    toolbarOpen = true;
    const caret = caretRect();
    if (caret) {
      showToolbarAt(caret.x, caret.bottom);
      return;
    }
    const point = linePoint(event.clientX, event.clientY);
    showToolbarAt(point.x, point.y);
  }

  editorCanvas.addEventListener("contextmenu", openToolbarAtClick);
  editorCanvas.addEventListener("mousedown", (event) => {
    if (event.button === 0) hideToolbar();
  });

  floatingToolbar.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const cmd = btn.dataset.cmd;
      const block = btn.dataset.block;
      if (cmd) document.execCommand(cmd, false, null);
      if (block) document.execCommand("formatBlock", false, block);
      writeCanvasIntoCurrentDocument();
      updateMetricsAndOutline();
      scheduleSave();
    });
  });

  aaMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    aaPopover.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!aaPopover.contains(event.target) && event.target !== aaMenuBtn) {
      aaPopover.classList.add("hidden");
    }
    if (!contextMenu.contains(event.target)) closeMenu();
  });

  document.querySelectorAll(".font-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = btn.dataset.fontChoice;
      const doc = activeDocument();
      if (doc) doc.font = choice;
      applyDocumentFont(choice);
      scheduleSave();
    });
  });

  document.querySelectorAll(".theme-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".theme-opt").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      document.body.setAttribute("data-theme", btn.dataset.themeChoice);
      scheduleSave();
    });
  });

  getHintBtn.addEventListener("mousedown", (event) => event.preventDefault());
  getHintBtn.addEventListener("click", showHint);

  closePopoverBtn.addEventListener("click", () => {
    parkPopover();
  });

  window.addEventListener("resize", closeMenu);
  editorScroll.addEventListener("scroll", closeMenu, { passive: true });
  libraryMain.addEventListener("scroll", closeMenu, { passive: true });
  window.addEventListener("beforeunload", () => {
    if (editorScreen.classList.contains("active")) writeCanvasIntoCurrentDocument();
    saveNow();
  });

  function setAuthMode(mode) {
    authMode = mode;
    const login = mode === "login";
    showLoginBtn.classList.toggle("active", login);
    showSignupBtn.classList.toggle("active", !login);
    showLoginBtn.setAttribute("aria-selected", login ? "true" : "false");
    showSignupBtn.setAttribute("aria-selected", login ? "false" : "true");
    authSubmit.textContent = login ? "Log in" : "Sign up";
    authPassword.setAttribute("autocomplete", login ? "current-password" : "new-password");
    authError.textContent = "";
  }

  function showScreen(name) {
    authScreen.classList.toggle("active", name === "auth");
    libraryScreen.classList.toggle("active", name === "library");
    editorScreen.classList.toggle("active", name === "editor");
    if (name !== "editor") {
      hideToolbar();
      aaPopover.classList.add("hidden");
      parkPopover();
      document.body.classList.remove("is-typing");
    }
    closeMenu();
  }

  function openLibrary(view, typed) {
    if (editorScreen.classList.contains("active")) {
      writeCanvasIntoCurrentDocument();
      saveNow();
    }
    libraryView = view === "trash" ? "trash" : "home";
    showScreen("library");
    renderLibrary();
    showUserTitle(Boolean(typed));
  }

  function showUserTitle(typed) {
    const name = state.session || "";
    const greeting = name ? `Welcome ${name}!` : "";
    clearInterval(greetTimer);
    if (!typed) {
      userTitle.textContent = greeting;
      return;
    }
    userTitle.textContent = "";
    let index = 0;
    greetTimer = setInterval(() => {
      index += 1;
      userTitle.textContent = greeting.slice(0, index);
      if (index >= greeting.length) clearInterval(greetTimer);
    }, 55);
  }

  function renderLibrary() {
    const trashView = libraryView === "trash";
    document.querySelectorAll(".lib-nav-btn[data-library-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.libraryView === libraryView);
    });
    libraryTitle.textContent = trashView ? "Trash" : "Documents";
    librarySubtitle.textContent = trashView ? "Documents you moved to trash" : "Recent documents";
    const trashedCount = allDocuments().filter((doc) => doc.trashed).length;
    trashCount.textContent = trashedCount ? String(trashedCount) : "";
    emptyTrashBtn.classList.toggle("hidden", !trashView || trashedCount === 0);

    const docs = allDocuments()
      .filter((doc) => (trashView ? doc.trashed : !doc.trashed))
      .sort((a, b) => (trashView ? b.trashedAt - a.trashedAt : b.updatedAt - a.updatedAt));

    docGrid.innerHTML = "";
    if (!trashView) docGrid.appendChild(newDocCard());
    libraryEmpty.classList.toggle("hidden", docs.length !== 0 || !trashView);
    libraryEmpty.textContent = "Trash is empty.";
    docs.forEach((doc) => docGrid.appendChild(documentCard(doc, trashView)));
  }

  function newDocCard() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "doc-card new-doc-card";
    button.setAttribute("aria-label", "New document");
    button.innerHTML = '<span class="new-doc-plus" aria-hidden="true">+</span>';
    button.addEventListener("click", createDocument);
    return button;
  }

  function documentCard(doc, trashView) {
    const card = document.createElement("article");
    card.className = `doc-card${trashView ? " is-trash" : ""}`;
    if (!trashView) {
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.addEventListener("click", () => openDocument(doc.id));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDocument(doc.id);
        }
      });
    }

    const thumb = document.createElement("div");
    thumb.className = "doc-thumb";
    const preview = document.createElement("p");
    preview.textContent = documentPreview(doc) || "Empty document";
    thumb.appendChild(preview);

    const meta = document.createElement("div");
    meta.className = "doc-meta";
    const titleRow = document.createElement("div");
    titleRow.className = "doc-title-row";
    const title = document.createElement("h2");
    title.className = "doc-title";
    title.textContent = doc.title || "Untitled";
    const kebab = kebabButton(trashView ? "Trashed document options" : "Document options");
    kebab.addEventListener("click", (event) => {
      event.stopPropagation();
      if (trashView) {
        openMenu(kebab, [
          { label: "Restore", action: () => restoreDocument(doc.id) },
          { label: "Delete forever", danger: true, action: () => deleteDocumentForever(doc.id) },
        ]);
      } else {
        openMenu(kebab, [
          { label: "Move to trash", danger: true, action: () => trashDocument(doc.id) },
        ]);
      }
    });
    titleRow.append(title, kebab);

    const time = document.createElement("p");
    time.className = "doc-time";
    time.textContent = formatRelative(trashView ? doc.trashedAt : doc.updatedAt, trashView ? "Trashed" : "Edited");
    const stamp = document.createElement("p");
    stamp.className = "doc-time";
    stamp.textContent = formatEditedStamp(trashView ? doc.trashedAt : doc.updatedAt);
    if (trashView) {
      const extra = document.createElement("p");
      extra.className = "doc-extra";
      extra.textContent = "In trash";
      meta.append(titleRow, time, stamp, extra);
    } else {
      meta.append(titleRow, time, stamp);
    }
    card.append(thumb, meta);
    return card;
  }

  function createDocument() {
    const doc = {
      id: uid(),
      title: "Untitled document",
      content: "<h1>Untitled document</h1><p><br></p>",
      font: "serif",
      updatedAt: Date.now(),
      trashed: false,
      trashedAt: null,
    };
    allDocuments().unshift(doc);
    saveNow();
    openDocument(doc.id);
  }

  function trashDocument(id) {
    const doc = findDocument(id);
    if (!doc) return;
    doc.trashed = true;
    doc.trashedAt = Date.now();
    saveNow();
    renderLibrary();
  }

  function restoreDocument(id) {
    const doc = findDocument(id);
    if (!doc) return;
    doc.trashed = false;
    doc.trashedAt = null;
    doc.updatedAt = Date.now();
    saveNow();
    renderLibrary();
  }

  function deleteDocumentForever(id) {
    if (!window.confirm("Delete this document forever?")) return;
    const lib = library();
    lib.documents = lib.documents.filter((doc) => doc.id !== id);
    if (currentDocId === id) currentDocId = null;
    saveNow();
    renderLibrary();
  }

  function openDocument(id) {
    const doc = findDocument(id);
    if (!doc || doc.trashed) return;
    if (editorScreen.classList.contains('active')) writeCanvasIntoCurrentDocument();
    currentDocId = doc.id;
    showScreen('editor');
    parkPopover();
    editorCanvas.innerHTML = doc.content || '<h1>Untitled document</h1><p></p>';
    editorCanvas.querySelectorAll(".outline-flash, .is-current-heading, .flagged-sentence, .active-block").forEach((el) => {
      el.classList.remove("outline-flash", "is-current-heading", "flagged-sentence", "active-block");
    });
    editorCanvas.setAttribute("contenteditable", "true");
    applyDocumentFont(doc.font);
    doc.updatedAt = Date.now();
    updateMetricsAndOutline();
    saveNow();
    editorCanvas.focus();
  }

  function updateMetricsAndOutline() {
    const clone = editorCanvas.cloneNode(true);
    const popInClone = clone.querySelector("#socraticPopover");
    if (popInClone) popInClone.remove();

    const text = (clone.innerText || "").trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    const readMins = Math.max(1, Math.ceil(words / 200));
    wordCountLabel.textContent = `${words} words`;
    charCountLabel.textContent = `${chars} chars`;
    readTimeLabel.textContent = `${readMins} min read`;

    outlineList.innerHTML = "";
    const headings = editorCanvas.querySelectorAll("h1, h2, h3");
    headings.forEach((heading, index) => {
      heading.dataset.outlineId = String(index);
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const tag = heading.tagName.toLowerCase();
      button.className = `outline-item outline-${tag}`;
      button.dataset.outlineId = String(index);
      button.textContent = heading.textContent.trim() || "Untitled";
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => revealHeading(heading));
      li.appendChild(button);
      outlineList.appendChild(li);
    });
    syncOutlineToCaret();
    refreshEditedLabel();
  }

  function revealHeading(heading) {
    if (!heading) return;
    heading.scrollIntoView({ behavior: "smooth", block: "start" });
    placeCaretAtStart(heading);
    markCurrentHeading(heading);
    updateActiveBlock();
  }

  function syncOutlineToCaret() {
    markCurrentHeading(headingAtCaret());
  }

  function markCurrentHeading(heading) {
    outlineList.querySelectorAll(".outline-item.active").forEach((el) => el.classList.remove("active"));
    if (!heading) return;
    const item = outlineList.querySelector(`[data-outline-id="${heading.dataset.outlineId}"]`);
    if (item) item.classList.add("active");
  }

  function headingAtCaret() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.anchorNode) return null;
    if (!editorCanvas.contains(selection.anchorNode)) return null;
    const node = selection.anchorNode;
    const headings = [...editorCanvas.querySelectorAll("h1, h2, h3")];
    let current = null;
    for (const heading of headings) {
      if (heading === node || heading.contains(node)) return heading;
      const position = heading.compareDocumentPosition(node);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) current = heading;
    }
    return current;
  }

  function placeCaretAtStart(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    editorCanvas.focus();
  }

  function updateActiveBlock() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    let node = selection.anchorNode;
    while (node && node.parentNode !== editorCanvas) node = node.parentNode;
    editorCanvas.querySelectorAll(".active-block").forEach((el) => el.classList.remove("active-block"));
    if (node && node.nodeType === 1 && node !== socraticPopover) {
      node.classList.add("active-block");
      lastActiveBlock = node;
    }
  }

  function handleMarkdownShortcuts() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const node = selection.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent;
    const blockMap = {
      "# ": "H1",
      "## ": "H2",
      "### ": "H3",
      "> ": "BLOCKQUOTE",
    };

    for (const [prefix, tag] of Object.entries(blockMap)) {
      if (text.startsWith(prefix)) {
        node.textContent = text.slice(prefix.length);
        document.execCommand("formatBlock", false, tag);
        return;
      }
    }
  }

  function writeCanvasIntoCurrentDocument() {
    const doc = activeDocument();
    if (!doc || editorCanvas.getAttribute("contenteditable") !== "true") return;
    doc.content = readCanvasHTML();
    const heading = extractTitle();
    if (heading) doc.title = heading;
    doc.updatedAt = Date.now();
  }

  let hintRange = null;

  function rememberHintRange() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.anchorNode) return;
    if (!editorCanvas.contains(selection.anchorNode)) return;
    hintRange = selection.getRangeAt(0).cloneRange();
  }

  function activeEditorRange() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount && selection.anchorNode && editorCanvas.contains(selection.anchorNode)) {
      return selection.getRangeAt(0);
    }
    if (hintRange && hintRange.startContainer && editorCanvas.contains(hintRange.startContainer)) return hintRange;
    return null;
  }

  function showHint() {
    const target = resolveHintTarget();
    editorCanvas.querySelectorAll(".flagged-sentence").forEach((el) => el.classList.remove("flagged-sentence"));
    if (!target) {
      popoverText.textContent = "Click into a sentence, or highlight a few words, then ask for a hint.";
      canvasWrapper.appendChild(socraticPopover);
      socraticPopover.classList.remove("hidden");
      return;
    }
    if (target.block && target.block !== socraticPopover) {
      target.block.classList.add("flagged-sentence");
      target.block.insertAdjacentElement("afterend", socraticPopover);
    }
    popoverText.textContent = hintForText(target.text, target.block);
    socraticPopover.classList.remove("hidden");
  }

  function resolveHintTarget() {
    const range = activeEditorRange();
    if (range && !range.collapsed) {
      const selected = range.toString().replace(/\s+/g, " ").trim();
      if (selected) return { text: selected, block: blockForNode(range.startContainer) };
    }
    const block =
      (range && blockForNode(range.startContainer)) ||
      (lastActiveBlock && editorCanvas.contains(lastActiveBlock) && lastActiveBlock) ||
      editorCanvas.querySelector("p, li, blockquote, h1, h2, h3");
    if (!block || block === socraticPopover) return null;
    const sentence = sentenceInBlock(block, range);
    if (!sentence) return null;
    return { text: sentence, block };
  }

  function blockForNode(node) {
    while (node && node !== editorCanvas) {
      if (node.parentNode === editorCanvas && node !== socraticPopover) return node;
      node = node.parentNode;
    }
    return null;
  }

  function sentenceInBlock(block, range) {
    const full = block.innerText.replace(/\s+/g, " ").trim();
    if (!full) return "";
    if (!range || !range.startContainer || !block.contains(range.startContainer)) return full;
    const before = document.createRange();
    before.selectNodeContents(block);
    before.setEnd(range.startContainer, range.startOffset);
    const offset = before.toString().replace(/\s+/g, " ").trimStart().length;
    const parts = splitSentences(full);
    let cursor = 0;
    for (const part of parts) {
      if (offset <= cursor + part.length) return part;
      cursor += part.length + 1;
    }
    return parts[parts.length - 1] || full;
  }

  function splitSentences(text) {
    const parts = [];
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const mark = text[i];
      if (mark !== "." && mark !== "!" && mark !== "?") continue;
      const before = text.slice(Math.max(0, i - 6), i);
      if (mark === "." && /(?:^|\s)(?:Mr|Ms|Dr|e\.g|i\.e|al)$/i.test(before)) continue;
      const next = text[i + 1];
      if (next && next !== " ") continue;
      const sentence = text.slice(start, i + 1).trim();
      if (sentence) parts.push(sentence);
      start = i + 1;
    }
    const rest = text.slice(start).trim();
    if (rest) parts.push(rest);
    return parts.length ? parts : [text];
  }

  function hintForText(text, block) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return "Click into a sentence, or highlight a few words, then ask for a hint.";
    if (block && /^H[1-3]$/.test(block.tagName)) return "What is the claim of this section?";

    const words = clean.split(/\s+/);
    const vague = ["a lot", "very", "really", "things", "stuff", "everyone", "always", "never", "fast", "good", "bad", "important"];
    const found = vague
      .map((word) => ({ word, at: clean.toLowerCase().search(new RegExp(`\\b${word.replace(" ", "\\s+")}\\b`)) }))
      .filter((item) => item.at >= 0)
      .sort((a, b) => a.at - b.at)[0];
    if (found) return `What do you mean by “${found.word}”?`;
    if (/^(i think|i feel|i believe|in my opinion)\b/i.test(clean)) return "This is your view. What would make a reader agree?";
    if (words.length > 32) return "This sentence has more than one idea. Which one is the point?";
    if (/\([12][0-9]{3}\)|et al\.|according to/i.test(clean)) return "What does this source add to your argument?";
    if (words.length <= 8) return `Why does “${clean.replace(/[.!?]+$/g, "")}” matter here?`;
    return `What supports “${focusPhrase(clean)}”?`;
  }

  function focusPhrase(text) {
    const clause = text.split(/[,:;]/)[0].replace(/[.!?]+$/g, "").trim();
    const words = clause.split(/\s+/);
    if (words.length <= 8) return words.join(" ");
    return words.slice(0, 8).join(" ");
  }

  function readCanvasHTML() {
    const inside = editorCanvas.contains(socraticPopover);
    const next = inside ? socraticPopover.nextSibling : null;
    if (inside) socraticPopover.remove();
    editorCanvas.querySelectorAll(".outline-flash, .is-current-heading, .flagged-sentence, .active-block").forEach((el) => {
      el.classList.remove("outline-flash", "is-current-heading", "flagged-sentence", "active-block");
    });
    const html = editorCanvas.innerHTML;
    if (inside) editorCanvas.insertBefore(socraticPopover, next);
    return html;
  }

  function extractTitle() {
    const heading = editorCanvas.querySelector("h1");
    return heading ? heading.textContent.trim() : "";
  }

  function parkPopover() {
    socraticPopover.classList.add("hidden");
    if (editorCanvas.contains(socraticPopover)) canvasWrapper.appendChild(socraticPopover);
    editorCanvas.querySelectorAll(".flagged-sentence").forEach((el) => el.classList.remove("flagged-sentence"));
  }

  function documentPreview(doc) {
    if (!doc.content) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = doc.content;
    const heading = tmp.querySelector("h1");
    if (heading) heading.remove();
    return tmp.innerText.replace(/\s+/g, " ").trim();
  }

  function kebabButton(label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kebab-btn";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="5" r="1.7" fill="currentColor"></circle>
        <circle cx="12" cy="12" r="1.7" fill="currentColor"></circle>
        <circle cx="12" cy="19" r="1.7" fill="currentColor"></circle>
      </svg>`;
    return button;
  }

  function openMenu(anchor, items) {
    contextMenu.innerHTML = "";
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.label;
      button.setAttribute("role", "menuitem");
      if (item.danger) button.classList.add("danger");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        closeMenu();
        item.action();
      });
      contextMenu.appendChild(button);
    });
    contextMenu.classList.remove("hidden");
    contextMenu.style.visibility = "hidden";
    contextMenu.style.left = "0px";
    contextMenu.style.top = "0px";
    const menuRect = contextMenu.getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    let left = rect.right - menuRect.width;
    let top = rect.bottom + 6;
    if (left < 8) left = 8;
    if (left + menuRect.width > window.innerWidth - 8) left = window.innerWidth - menuRect.width - 8;
    if (top + menuRect.height > window.innerHeight - 8) top = Math.max(8, rect.top - menuRect.height - 6);
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.style.visibility = "visible";
  }

  function closeMenu() {
    contextMenu.classList.add("hidden");
    contextMenu.innerHTML = "";
  }

  function formatEditedStamp(timestamp) {
    return new Date(timestamp || Date.now()).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatRelative(timestamp, verb) {
    const delta = Date.now() - (timestamp || Date.now());
    const min = Math.round(delta / 60000);
    if (min < 1) return `${verb} just now`;
    if (min < 60) return `${verb} ${min} min ago`;
    const hours = Math.round(min / 60);
    if (hours < 24) return `${verb} ${hours} hr ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return `${verb} yesterday`;
    if (days < 14) return `${verb} ${days} days ago`;
    return `${verb} ${new Date(timestamp).toLocaleDateString()}`;
  }

  function library() {
    if (!state.session) return null;
    return state.libraries[state.session] || null;
  }

  function ensureLibrary() {
    if (!state.session) return;
    if (!state.libraries[state.session]) {
      state.libraries[state.session] = { documents: [] };
    }
    flattenDocuments(state.libraries[state.session]);
  }

  function flattenDocuments(lib) {
    if (!lib || !Array.isArray(lib.documents)) return;
    const next = [];
    lib.documents.forEach((doc) => {
      if (!Array.isArray(doc.drafts)) {
        if (typeof doc.content !== "string") doc.content = "<h1>Untitled document</h1><p></p>";
        next.push(doc);
        return;
      }
      const live = doc.drafts.filter((draft) => !draft.trashed);
      const primary = live.find((draft) => draft.id === doc.primaryDraftId) || live[0];
      doc.content = primary && primary.content ? primary.content : "<h1>Untitled document</h1><p></p>";
      if (!doc.title && primary) doc.title = primary.title || "Untitled document";
      delete doc.drafts;
      delete doc.primaryDraftId;
      next.push(doc);
      live.filter((draft) => draft !== primary).forEach((draft) => {
        next.push({
          id: uid(),
          title: draft.title || "Untitled document",
          content: draft.content || "<h1>Untitled document</h1><p></p>",
          updatedAt: (doc.updatedAt || Date.now()) - 1000,
          trashed: false,
          trashedAt: null,
        });
      });
    });
    lib.documents = next;
  }

  function allDocuments() {
    const lib = library();
    return lib ? lib.documents : [];
  }

  function findDocument(id) {
    return allDocuments().find((doc) => doc.id === id) || null;
  }

  function activeDocument() {
    return findDocument(currentDocId);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    state.theme = document.body.getAttribute("data-theme") || "light";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function applyDocumentFont(font) {
    const choice = ["serif", "sans", "mono"].includes(font) ? font : "serif";
    editorBody.setAttribute("data-font", choice);
    document.querySelectorAll(".font-opt").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.fontChoice === choice);
    });
  }

  function refreshEditedLabel() {
    const doc = activeDocument();
    if (!doc) {
      editedLabel.textContent = "";
      return;
    }
    const date = new Date(doc.updatedAt || Date.now());
    const day = date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    editedLabel.textContent = `${day} at ${time}`;
  }

  function applyLibraryWidth(width) {
    const next = Math.round(Math.min(420, Math.max(180, Number(width) || 232)));
    document.documentElement.style.setProperty("--library-width", `${next}px`);
    state.libraryWidth = next;
  }

  [libraryResize, editorResize].forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      if (window.innerWidth <= 720) return;
      event.preventDefault();
      const zoom = parseFloat(getComputedStyle(document.documentElement).zoom);
      const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
      const startX = event.clientX;
      const startWidth = state.libraryWidth || 232;
      function move(moveEvent) {
        document.body.classList.add("is-resizing");
        applyLibraryWidth(startWidth + (moveEvent.clientX - startX) / scale);
      }
      function stop() {
        document.body.classList.remove("is-resizing");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", stop);
        saveNow();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop);
    });
  });

  function applyAppearance() {
    const theme = state.theme === "dark" ? "dark" : "light";
    document.body.setAttribute("data-theme", theme);
    document.querySelectorAll(".theme-opt").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeChoice === theme);
    });
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.users) || typeof parsed.libraries !== "object" || !parsed.libraries) {
        return freshState();
      }
      parsed.session = parsed.session || null;
      return parsed;
    } catch {
      return freshState();
    }
  }

  function freshState() {
    return { users: [], libraries: {}, session: null, theme: "light", font: "serif" };
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
});
