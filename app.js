(() => {
  const cfg = window.AUTODOC_CONFIG || {};

  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.startsWith("https://") &&
    !cfg.SUPABASE_URL.includes("PASTE_") &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

  const $ = (id) => document.getElementById(id);

  const authView = $("authView");
  const appView = $("appView");
  const logoutBtn = $("logoutBtn");

  let supabase = null;
  let user = null;
  let cars = [];
  let docs = [];
  let extraTaxes = [];
  let authMode = "login";

  const types = {
    itp: "ITP",
    rca: "RCA",
    rovinieta: "Rovinietă",
  };

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  // popup for successful login
  function showSuccessPopup() {
    const oldPopup = document.getElementById("successPopup");
    if (oldPopup) oldPopup.remove();

    const popup = document.createElement("div");
    popup.id = "successPopup";

    popup.innerHTML = `
    <div class="success-popup-content">
      <div class="success-icon">✓</div>
      <h3>Autentificare reușită!</h3>
      <p>Bine ai revenit în InfoAuto!</p>
    </div>
  `;

    document.body.appendChild(popup);

    setTimeout(() => {
      popup.classList.add("hide");

      setTimeout(() => {
        popup.remove();
      }, 300);
    }, 2000);
  }

  // popup for unscccessful login

  function showunSuccessPopup() {
    const oldPopup = document.getElementById("unSuccessPopup");
    if (oldPopup) oldPopup.remove();

    const popup = document.createElement("div");
    popup.id = "unSuccessPopup";

    popup.innerHTML = `
    <div class="success-popup-content error-popup-content">
      <div class="success-icon error-icon">✕</div>
      <h3>Autentificare eșuată!</h3>
      <p>Emailul sau parola sunt incorecte.</p>
    </div>
  `;

    document.body.appendChild(popup);

    setTimeout(() => {
      popup.classList.add("hide");

      setTimeout(() => {
        popup.remove();
      }, 300);
    }, 2500);
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2600);
  }

  function showApp(on) {
    authView.classList.toggle("hidden", on);
    appView.classList.toggle("hidden", !on);
    logoutBtn.classList.toggle("hidden", !on);
  }

  function dateText(s) {
    if (!s) return "—";

    return new Date(s + "T12:00:00").toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function daysLeft(s) {
    if (!s) return null;

    return Math.ceil((new Date(s + "T23:59:59") - new Date()) / 86400000);
  }

  function status(s) {
    const d = daysLeft(s);

    if (d === null) {
      return { c: "ok", t: "Fără expirare" };
    }

    if (d < 0) {
      return { c: "expired", t: "Expirat" };
    }

    if (d <= 30) {
      return {
        c: "soon",
        t: d === 0 ? "Expiră azi" : `În ${d} zile`,
      };
    }

    return { c: "ok", t: "Valabil" };
  }

  async function loadData() {
    const [c, d, t] = await Promise.all([
      supabase.from("vehicles").select("*").order("created_at"),
      supabase.from("vehicle_documents").select("*").order("expiry_date"),
      supabase.from("vehicle_extra_taxes").select("*").order("created_at"),
    ]);

    if (c.error || d.error || t.error) {
      console.error(c.error, d.error, t.error);
      toast("Nu am putut încărca datele.");
      return;
    }

    cars = c.data || [];
    docs = d.data || [];
    extraTaxes = t.data || [];

    render();
    checkReminders();
  }
  function formatPlate(plate) {
    return String(plate || "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/^([A-Z]{1,2})(\d{2,3})([A-Z]{3})$/, "$1 $2 $3");
  }

  function render() {
    $("carCount").textContent = cars.length;

    const latestDocs = new Map();

    docs.forEach((doc) => {
      const key = `${doc.vehicle_id}:${doc.doc_type}`;
      const existing = latestDocs.get(key);

      if (!existing || doc.expiry_date > existing.expiry_date) {
        latestDocs.set(key, doc);
      }
    });

    const currentDocs = [...latestDocs.values()];

    $("validCount").textContent = currentDocs.filter(
      (doc) => daysLeft(doc.expiry_date) >= 0,
    ).length;

    $("urgentCount").textContent = currentDocs.filter(
      (doc) => daysLeft(doc.expiry_date) <= 30,
    ).length;

    $("emptyState").classList.toggle("hidden", cars.length > 0);

    $("carsList").innerHTML = cars
      .map((car) => {
        const carDocs = docs.filter((d) => d.vehicle_id === car.id);

        const carTaxes = extraTaxes.filter((t) => t.vehicle_id === car.id);

        const mandatoryCards = ["itp", "rca", "rovinieta"]
          .map((type) => {
            const list = carDocs
              .filter((d) => d.doc_type === type)
              .sort((a, b) => b.expiry_date.localeCompare(a.expiry_date));

            const doc = list[0];
            const st = doc ? status(doc.expiry_date) : null;

            return `
            <div class="doc-card">
              <div class="doc-top">
                <strong>${types[type]}</strong>
                ${
                  doc
                    ? `<span class="status ${st.c}">${st.t}</span>`
                    : `<span class="status soon">Lipsește</span>`
                }
              </div>

              <div class="doc-date">
                ${doc ? dateText(doc.expiry_date) : "Necompletat"}
              </div>

              <div class="doc-sub">
                ${
                  doc && doc.cost != null
                    ? Number(doc.cost).toLocaleString("ro-RO") + " lei · "
                    : ""
                }
                ${
                  doc
                    ? list.length + " înregistrare(i)"
                    : "Adaugă data expirării"
                }
              </div>

              <div class="doc-footer">
                <span>
                  ${
                    doc && doc.issued_date
                      ? "Emis: " + dateText(doc.issued_date)
                      : " "
                  }
                </span>

                <button
                  data-doc-type="${type}"
                  data-car-id="${car.id}"
                >
                  ${doc ? "Actualizează" : "Adaugă"}
                </button>
              </div>
            </div>
          `;
          })
          .join("");

        const taxCards = carTaxes
          .map((tax) => {
            const st = status(tax.expiry_date);

            return `
          <div class="doc-card">
            <div class="doc-top">
              <strong>${esc(tax.name)}</strong>
              <span class="status ${st.c}">${st.t}</span>
            </div>

            <div class="doc-date">
              ${
                tax.expiry_date
                  ? dateText(tax.expiry_date)
                  : "Fără dată de expirare"
              }
            </div>

            <div class="doc-sub">
              ${
                tax.amount != null
                  ? Number(tax.amount).toLocaleString("ro-RO") + " lei"
                  : "Sumă necompletată"
              }
            </div>

            ${tax.notes ? `<p class="muted tiny">${esc(tax.notes)}</p>` : ""}

            <div class="doc-footer">
              <span>
                ${
                  tax.payment_date
                    ? "Plătit: " + dateText(tax.payment_date)
                    : ""
                }
              </span>

              <div class="car-actions">
                <button data-edit-tax="${tax.id}">
                  Actualizează
                </button>

                <button data-delete-tax="${tax.id}">
                  Șterge
                </button>
              </div>
            </div>
          </div>
        `;
          })
          .join("");

        return `
        <article class="car-card">
          <div class="car-head">
            <div>
              <h2>${esc(car.make_model)}</h2>
              <div class="ro-license-plate">
                <div class="ro-license-eu">
                  <span class="eu-stars">✦</span>
                  <span >RO</span>
                </div>
                <span class="ro-license-number">
                ${esc(formatPlate(car.plate))}
                </span>    
              </div>
              ${
                car.year
                  ? `<span class="muted tiny">${esc(car.year)}</span>`
                  : ""
              }

              ${car.notes ? `<p class="muted tiny">${esc(car.notes)}</p>` : ""}
            </div>
          </div>

            <details class="car-details">
        <summary class="car-details-toggle">
          <span>Detalii mașină</span>
          <span class="details-arrow">⌄</span>
        </summary>

                    <div class="car-actions">
              <button class="small-btn" data-add-doc="${car.id}">
                ＋ Document
              </button>

              <button class="small-btn" data-add-tax="${car.id}">
                ＋ Altă taxă
              </button>

              <button class="small-btn" data-delete-car="${car.id}">
                Șterge
              </button>
            </div>

        <div class="car-details-content">
          <div class="doc-grid">
            ${mandatoryCards}
            ${taxCards}
          </div>
        </div>
      </details>
        </article>
      `;
      })
      .join("");
  }

  async function saveCar(e) {
    e.preventDefault();

    const payload = {
      user_id: user.id,
      make_model: $("carName").value.trim(),
      plate: $("plate").value.trim().toUpperCase(),
      year: $("carYear").value ? Number($("carYear").value) : null,
      notes: $("carNotes").value.trim() || null,
    };

    const { error } = await supabase.from("vehicles").insert(payload);

    if (error) {
      console.error(error);
      toast("Eroare la salvarea mașinii.");
      return;
    }

    $("carDialog").close();
    $("carForm").reset();

    await loadData();
    toast("Mașina a fost adăugată.");
  }

  function openDoc(carId, type) {
    const doc = docs
      .filter((d) => d.vehicle_id === carId && d.doc_type === type)
      .sort((a, b) => b.expiry_date.localeCompare(a.expiry_date))[0];

    $("docForm").reset();

    $("docCarId").value = carId;
    $("docType").value = type;

    $("docTitle").textContent =
      types[type] + (doc ? " – actualizare" : " – adăugare");

    $("expiry").value = doc?.expiry_date || "";
    $("issued").value = doc?.issued_date || "";
    $("cost").value = doc?.cost ?? "";
    $("docNotes").value = doc?.notes || "";

    $("docForm").dataset.editId = doc?.id || "";
    $("docDialog").showModal();
  }

  async function saveDoc(e) {
    e.preventDefault();

    const editId = $("docForm").dataset.editId;

    const payload = {
      user_id: user.id,
      vehicle_id: $("docCarId").value,
      doc_type: $("docType").value,
      expiry_date: $("expiry").value,
      issued_date: $("issued").value || null,
      cost: $("cost").value ? Number($("cost").value) : null,
      notes: $("docNotes").value.trim() || null,
    };

    const result = editId
      ? await supabase
          .from("vehicle_documents")
          .update(payload)
          .eq("id", editId)
          .eq("user_id", user.id)
      : await supabase.from("vehicle_documents").insert(payload);

    if (result.error) {
      console.error(result.error);
      toast("Eroare la salvarea documentului.");
      return;
    }

    $("docDialog").close();
    $("docForm").reset();
    $("docForm").dataset.editId = "";

    await loadData();

    toast(
      editId ? "Documentul a fost actualizat." : "Documentul a fost adăugat.",
    );
  }

  async function deleteCar(id) {
    if (!confirm("Ștergi mașina și toate documentele și taxele asociate?"))
      return;

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      toast("Nu am putut șterge mașina.");
      return;
    }

    await loadData();
    toast("Mașina a fost ștearsă.");
  }

  // Formularul pentru taxele personalizate
  function ensureTaxDialog() {
    if ($("taxDialog")) {
      if (!$("taxForm")) {
        toast("Formularul pentru taxe este incomplet.");
        return false;
      }

      if (!$("taxForm").dataset.bound) {
        $("taxForm").addEventListener("submit", saveTax);

        const cancel = $("cancelTaxBtn") || $("taxCancel");
        if (cancel) {
          cancel.addEventListener("click", () => {
            $("taxDialog").close();
          });
        }

        $("taxForm").dataset.bound = "true";
      }

      return true;
    }

    const dialog = document.createElement("dialog");
    dialog.id = "taxDialog";

    dialog.innerHTML = `
      <form
        id="taxForm"
        class="dialog-form"
        style="display:grid;gap:12px;min-width:min(85vw,350px)"
      >
        <h2 id="taxDialogTitle">Altă taxă</h2>

        <label>
          Denumirea taxei
          <input
            id="taxName"
            type="text"
            required
            maxlength="100"
            placeholder="Impozit, CASCO, parcare..."
          >
        </label>

        <label>
          Suma (lei)
          <input
            id="taxAmount"
            type="number"
            min="0"
            step="0.01"
          >
        </label>

        <label>
          Data plății
          <input id="taxPaymentDate" type="date">
        </label>

        <label>
          Data expirării (opțional)
          <input id="taxExpiry" type="date">
        </label>

        <label>
          Observații
          <textarea id="taxNotes" rows="3"></textarea>
        </label>

        <div class="dialog-actions">
          <button type="button" id="taxCancel">
            Anulează
          </button>

          <button type="submit" class="primary">
            Salvează
          </button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);

    $("taxCancel").addEventListener("click", () => {
      dialog.close();
    });

    $("taxForm").addEventListener("submit", saveTax);
    $("taxForm").dataset.bound = "true";

    return true;
  }

  function openTax(carId, taxId = null) {
    if (!ensureTaxDialog()) return;

    const tax = taxId ? extraTaxes.find((t) => t.id === taxId) : null;

    if (taxId && !tax) {
      toast("Taxa nu a fost găsită.");
      return;
    }

    $("taxForm").reset();

    $("taxForm").dataset.carId = tax?.vehicle_id || carId;
    $("taxForm").dataset.editId = tax?.id || "";

    $("taxDialogTitle").textContent = tax
      ? "Actualizează taxa"
      : "Adaugă altă taxă";

    $("taxName").value = tax?.name || "";
    $("taxAmount").value = tax?.amount ?? "";
    $("taxPaymentDate").value = tax?.payment_date || "";
    $("taxExpiry").value = tax?.expiry_date || "";
    $("taxNotes").value = tax?.notes || "";

    $("taxDialog").showModal();
  }

  async function saveTax(e) {
    e.preventDefault();

    if (!user) {
      toast("Trebuie să fii autentificat.");
      return;
    }

    const form = $("taxForm");
    const editId = form.dataset.editId;

    const payload = {
      user_id: user.id,
      vehicle_id: form.dataset.carId,
      name: $("taxName").value.trim(),
      amount: $("taxAmount").value === "" ? null : Number($("taxAmount").value),
      payment_date: $("taxPaymentDate").value || null,
      expiry_date: $("taxExpiry").value || null,
      notes: $("taxNotes").value.trim() || null,
    };

    if (!payload.name) {
      toast("Completează denumirea taxei.");
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) submitButton.disabled = true;

    try {
      const result = editId
        ? await supabase
            .from("vehicle_extra_taxes")
            .update(payload)
            .eq("id", editId)
            .eq("user_id", user.id)
            .select("id")
        : await supabase
            .from("vehicle_extra_taxes")
            .insert(payload)
            .select("id");

      if (result.error || !result.data?.length) {
        console.error(result.error);
        toast("Taxa nu a putut fi salvată.");
        return;
      }

      $("taxDialog").close();

      await loadData();

      toast(editId ? "Taxa a fost actualizată." : "Taxa a fost adăugată.");
    } catch (error) {
      console.error(error);
      toast("A apărut o eroare la salvare.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function deleteTax(taxId) {
    const tax = extraTaxes.find((t) => t.id === taxId);
    if (!tax) return;

    if (!confirm(`Sigur ștergi taxa "${tax.name}"?`)) {
      return;
    }

    const { data, error } = await supabase
      .from("vehicle_extra_taxes")
      .delete()
      .eq("id", taxId)
      .eq("user_id", user.id)
      .select("id");

    if (error || !data?.length) {
      console.error(error);
      toast("Nu am putut șterge taxa.");
      return;
    }

    await loadData();
    toast("Taxa a fost ștearsă.");
  }

  // Notificări locale când aplicația este deschisă
  async function checkReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;

    const today = new Date();
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    const seenKey = "autodoc_notified_" + todayKey;

    let seen = [];

    try {
      seen = JSON.parse(localStorage.getItem(seenKey) || "[]");
    } catch {
      seen = [];
    }

    const reminders = [
      ...docs.map((d) => ({
        id: "doc:" + d.id,
        vehicle_id: d.vehicle_id,
        name: types[d.doc_type] || d.doc_type,
        expiry_date: d.expiry_date,
      })),
      ...extraTaxes
        .filter((t) => t.expiry_date)
        .map((t) => ({
          id: "tax:" + t.id,
          vehicle_id: t.vehicle_id,
          name: t.name,
          expiry_date: t.expiry_date,
        })),
    ];

    reminders.forEach((item) => {
      const n = daysLeft(item.expiry_date);
      const reminderKey = item.id + ":" + n;

      if ([30, 15, 7, 0].includes(n) && !seen.includes(reminderKey)) {
        const car = cars.find((c) => c.id === item.vehicle_id);

        try {
          new Notification("InfoAuto · " + item.name, {
            body: `${car?.make_model || "Mașina"}: expiră ${
              n === 0 ? "astăzi" : "în " + n + " zile"
            }.`,
          });

          seen.push(reminderKey);
        } catch (error) {
          console.warn("Notificare locală:", error);
        }
      }
    });

    localStorage.setItem(seenKey, JSON.stringify(seen));
  }

  async function start() {
    if (!configured || !window.supabase) {
      $("authMessage").textContent =
        "Conectarea la baza de date nu este configurată încă. Vezi fișierul README.";
      return;
    }

    supabase = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY,
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      user = session.user;
      showApp(true);
      await loadData();
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user = session?.user || null;
      showApp(!!user);

      if (user) {
        await loadData();
      }
    });
  }

  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.addEventListener("click", () => {
      authMode = b.dataset.tab;

      document.querySelectorAll("[data-tab]").forEach((x) => {
        x.classList.toggle("active", x === b);
      });

      $("authSubmit").textContent =
        authMode === "login" ? "Intră în cont" : "Creează cont";

      $("password").autocomplete =
        authMode === "login" ? "current-password" : "new-password";
    });
  });

  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    // Completează emailul salvat anterior
    const savedEmail = localStorage.getItem("infoauto_remember_email");

    if (savedEmail) {
      $("email").value = savedEmail;
      $("rememberEmail").checked = true;
    }

    if (!supabase) {
      toast("Aplicația trebuie conectată la Supabase.");
      return;
    }

    $("authSubmit").disabled = true;

    const email = $("email").value.trim();
    const password = $("password").value;

    if ($("rememberEmail").checked) {
      localStorage.setItem("infoauto_remember_email", email);
    } else {
      localStorage.removeItem("infoauto_remember_email");
    }

    const result =
      authMode === "login"
        ? await supabase.auth.signInWithPassword({
            email,
            password,
          })
        : await supabase.auth.signUp({
            email,
            password,
          });

    $("authSubmit").disabled = false;

    if (result.error) {
      $("authMessage").textContent = "";
      showunSuccessPopup();
      return;
    }

    if (authMode === "signup") {
      $("authMessage").textContent =
        "Cont creat. Verifică emailul dacă confirmarea este activată.";
    } else {
      $("authMessage").textContent = "";
      showSuccessPopup();
    }

    if (result.data.session) {
      user = result.data.user;
      showApp(true);
      await loadData();
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    user = null;
    showApp(false);
  });

  $("addCarBtn").addEventListener("click", () => {
    $("carDialog").showModal();
  });

  $("emptyAddBtn").addEventListener("click", () => {
    $("carDialog").showModal();
  });

  $("carForm").addEventListener("submit", saveCar);
  $("docForm").addEventListener("submit", saveDoc);

  document.body.addEventListener("click", (e) => {
    const addDoc = e.target.closest("[data-add-doc]");

    if (addDoc) {
      openDoc(addDoc.dataset.addDoc, "itp");
      return;
    }

    const docButton = e.target.closest("[data-doc-type]");

    if (docButton) {
      openDoc(docButton.dataset.carId, docButton.dataset.docType);
      return;
    }

    const addTax = e.target.closest("[data-add-tax]");

    if (addTax) {
      openTax(addTax.dataset.addTax);
      return;
    }

    const editTax = e.target.closest("[data-edit-tax]");

    if (editTax) {
      openTax(null, editTax.dataset.editTax);
      return;
    }

    const removeTax = e.target.closest("[data-delete-tax]");

    if (removeTax) {
      deleteTax(removeTax.dataset.deleteTax);
      return;
    }

    const deleteCarButton = e.target.closest("[data-delete-car]");

    if (deleteCarButton) {
      deleteCar(deleteCarButton.dataset.deleteCar);
      return;
    }

    const close = e.target.closest("[data-close]");

    if (close) {
      $(close.dataset.close).close();
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(console.warn);
    });
  }

  // Abonare la notificări Web Push
  $("appView").addEventListener("click", async (e) => {
    if (e.target.id !== "enableNotifications") return;

    try {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        toast("Acest dispozitiv nu suportă notificări push.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        toast("Permisiunea pentru notificări nu a fost acordată.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const publicKey = cfg.VAPID_PUBLIC_KEY;

      if (!publicKey) {
        toast("Lipsește cheia publică VAPID.");
        return;
      }

      function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

        const base64 = (base64String + padding)
          .replace(/-/g, "+")
          .replace(/_/g, "/");

        const rawData = atob(base64);

        return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const subscriptionData = subscription.toJSON();

      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        throw new Error("Utilizatorul nu este autentificat.");
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: currentUser.id,
          endpoint: subscription.endpoint,
          p256dh: subscriptionData.keys.p256dh,
          auth_key: subscriptionData.keys.auth,
        },
        { onConflict: "user_id,endpoint" },
      );

      if (error) throw error;

      toast("Telefonul a fost abonat la notificări push!");
    } catch (error) {
      console.error("Eroare Web Push:", error);
      toast("Nu am putut activa notificările.");
    }
  });
  
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

function updateThemeIcon() {
  const isDark =
    document.documentElement.getAttribute("data-theme") === "dark";

  if (themeIcon) {
    themeIcon.textContent = isDark ? "☀" : "☾";
  }
}

updateThemeIcon();

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const currentTheme =
      document.documentElement.getAttribute("data-theme");

    const newTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("infoauto-theme", newTheme);

    updateThemeIcon();
  });
}


  start();
})();


