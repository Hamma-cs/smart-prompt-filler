// القالب الافتراضي
const DEFAULT_TEMPLATE = `[دور النظام]
أنت مساعد ذكاء اصطناعي متقدم، مهمتك هي: ________________________________

[السياق]
الموضوع: __________________________
الجمهور: __________________________

[المهمة]
أجب على السؤال التالي: ___________________________________________
`;

// =======================================================
// عناصر DOM
// =======================================================
const templateTextarea = document.getElementById('template');
const fillBtn = document.getElementById('fillBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const status = document.getElementById('status');
const templateNameInput = document.getElementById('templateName'); // جديد
const templatesList = document.getElementById('templatesList');   // جديد

// =======================================================
// وظائف المساعدة العامة
// =======================================================
function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

// =======================================================
// وظائف إدارة القوالب
// =======================================================

// تحميل القالب الحالي والقوالب المحفوظة
function loadTemplate() {
    chrome.storage.sync.get(['currentTemplate', 'savedTemplates'], (result) => {
        // تحميل القالب الموجود في منطقة التحرير (currentTemplate)
        templateTextarea.value = result.currentTemplate || DEFAULT_TEMPLATE;
        // عرض قائمة القوالب المحفوظة
        renderTemplateList(result.savedTemplates || {});
    });
}

// حفظ القالب الحالي باسم جديد
function saveTemplate() {
    const templateName = templateNameInput.value.trim();
    const templateContent = templateTextarea.value.trim();

    if (!templateName) {
        showStatus('⚠️ يرجى إدخال اسم للقالب أولاً.', 'error');
        return;
    }
    if (!templateContent) {
        showStatus('⚠️ القالب فارغ! يرجى إدخال نص.', 'error');
        return;
    }

    chrome.storage.sync.get(['savedTemplates'], (result) => {
        const savedTemplates = result.savedTemplates || {};
        
        // التحقق من تكرار الاسم
        if (savedTemplates[templateName]) {
            if (!confirm(`القالب باسم "${templateName}" موجود بالفعل. هل تريد الكتابة فوقه؟`)) {
                return;
            }
        }
        
        savedTemplates[templateName] = templateContent;
        
        chrome.storage.sync.set({ savedTemplates }, () => {
            templateNameInput.value = ''; // مسح حقل الاسم
            showStatus(`✅ تم حفظ القالب "${templateName}" بنجاح.`, 'success');
            renderTemplateList(savedTemplates);
        });
    });
}

// تحميل قالب محدد إلى منطقة التحرير
function loadTemplateByName(templateName, templateContent, savedTemplates) {
    templateTextarea.value = templateContent;
    // حفظ القالب المُحمّل كقالب افتراضي حالي
    chrome.storage.sync.set({ currentTemplate: templateContent }, () => {
        showStatus(`✅ تم تحميل القالب "${templateName}".`, 'success');
    });
    // إعادة عرض القائمة لتحديث الحالة (اختياري)
    renderTemplateList(savedTemplates);
}

// حذف قالب محدد
function deleteTemplate(templateName) {
    if (!confirm(`هل أنت متأكد من أنك تريد حذف القالب "${templateName}"؟`)) {
        return;
    }

    chrome.storage.sync.get(['savedTemplates'], (result) => {
        const savedTemplates = result.savedTemplates || {};
        delete savedTemplates[templateName];
        
        chrome.storage.sync.set({ savedTemplates }, () => {
            showStatus(`🗑️ تم حذف القالب "${templateName}".`, 'success');
            renderTemplateList(savedTemplates);
            // إذا كان القالب المحذوف هو المحتوى الحالي، نحمّل الافتراضي
            if (templateTextarea.value.trim() === savedTemplates[templateName]) {
                templateTextarea.value = DEFAULT_TEMPLATE;
            }
        });
    });
}

// عرض قائمة القوالب المحفوظة
function renderTemplateList(savedTemplates) {
    templatesList.innerHTML = '';
    const names = Object.keys(savedTemplates);

    if (names.length === 0) {
        templatesList.innerHTML = '<li>لا توجد قوالب محفوظة حالياً.</li>';
        return;
    }

    names.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        li.title = 'انقر للتحميل';

        // زر الحذف
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '✖';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = `حذف القالب "${name}"`;
        
        // حدث الحذف
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // لمنع تشغيل حدث تحميل القالب
            deleteTemplate(name);
        });
        
        // حدث تحميل القالب
        li.addEventListener('click', () => {
            loadTemplateByName(name, savedTemplates[name], savedTemplates);
        });
        
        li.appendChild(deleteBtn);
        templatesList.appendChild(li);
    });
}


// استعادة القالب الافتراضي (مع حفظه كقالب حالي)
function resetTemplate() {
  templateTextarea.value = DEFAULT_TEMPLATE;
  chrome.storage.sync.set({ currentTemplate: DEFAULT_TEMPLATE }, () => {
    showStatus('🔄 تم استعادة القالب الافتراضي', 'success');
  });
}

// وظيفة الملء التلقائي (منطق V4 الموثوق به)
async function fillForm() {
  const template = templateTextarea.value.trim();
  if (!template) {
    showStatus('⚠️ القالب فارغ!', 'error');
    return;
  }
  
  // قبل الملء، نحفظ القالب في التخزين المؤقت
  chrome.storage.sync.set({ currentTemplate: template });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // حقن وتنفيذ الدالة insertTextIntoTargetField
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: insertTextIntoTargetField,
      args: [template] // تمرير القالب كمتغير إلى الدالة
    });

    const filled = results && results.length > 0 && results[0].result === true;

    if (filled) {
      showStatus('✅ تم الملء بنجاح!', 'success');
      setTimeout(() => window.close(), 1000);
    } else {
      showStatus('⚠️ فشل الملء. لم يتم العثور على حقل نصي صالح أو حدث خطأ.', 'error');
    }

  } catch (error) {
    console.error('Error during scripting:', error);
    showStatus('❌ خطأ: ' + error.message, 'error');
  }
}

// =======================================================
// الدالة الرئيسية التي سيتم حقنها في الصفحة المستهدفة (منطق V4)
// يجب أن تظل خارج نطاق fillForm لتكون قابلة للحقن
// =======================================================
function insertTextIntoTargetField(templateText) {
  
  function isValidInputElement(element) {
    if (!element || element.disabled || element.readOnly) return false;
    const tagName = element.tagName;
    const isInputType = tagName === 'INPUT' && (element.type === 'text' || element.type === 'search' || !element.type);
    const isTextarea = tagName === 'TEXTAREA';
    const isContentEditable = element.isContentEditable || element.getAttribute('role') === 'textbox';
    return isInputType || isTextarea || isContentEditable;
  }

  function isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }
  
  function findTargetElement() {
    let element = document.activeElement;
    if (isValidInputElement(element) && isElementVisible(element)) return element;

    const specificSelectors = ['#prompt-textarea', 'textarea[placeholder*="Ask me"]'];
    for (const selector of specificSelectors) {
      element = document.querySelector(selector);
      if (element && isValidInputElement(element) && isElementVisible(element)) return element;
    }
    
    const generalSelectors = ['textarea:not([disabled]):not([readonly])', '[role="textbox"]'];
    for (const selector of generalSelectors) {
      element = document.querySelector(selector);
      if (element && isValidInputElement(element) && isElementVisible(element)) return element;
    }

    element = document.querySelector('[contenteditable="true"]');
    if (element && isValidInputElement(element) && isElementVisible(element)) return element;

    return null;
  }

  const targetElement = findTargetElement();

  if (targetElement) {
    targetElement.focus();

    if (targetElement.isContentEditable || targetElement.getAttribute('role') === 'textbox') {
      try {
        document.execCommand('insertText', false, templateText);
      } catch (e) {
        targetElement.textContent = templateText;
      }
    } else if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
      targetElement.value = templateText;
    }

    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
    
    // التأثير البصري
    const originalOutline = targetElement.style.outline;
    const originalBoxShadow = targetElement.style.boxShadow;
    targetElement.style.outline = '3px solid #667eea';
    targetElement.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
    setTimeout(() => {
        targetElement.style.outline = originalOutline;
        targetElement.style.boxShadow = originalBoxShadow;
    }, 1000);

    return true;
  }
  return false;
}

// =======================================================
// ربط الأحداث وتشغيلها
// =======================================================
fillBtn.addEventListener('click', fillForm);
saveBtn.addEventListener('click', saveTemplate);
resetBtn.addEventListener('click', resetTemplate);

// اختصارات لوحة المفاتيح
templateTextarea.addEventListener('keydown', (e) => {
  // حفظ القالب (سنترك هذه الوظيفة لحفظ القالب الحالي في currentTemplate فقط)
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    chrome.storage.sync.set({ currentTemplate: templateTextarea.value.trim() }, () => {
        showStatus('✅ تم تحديث القالب الحالي', 'success');
    });
  }
  // ملء تلقائي
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    fillForm();
  }
});

// تحميل القوالب عند فتح النافذة
loadTemplate();