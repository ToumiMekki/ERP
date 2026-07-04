const messages = {
  // Welcome and activation
  askPhone: 'مرحباً بك 👋\nأنا بوت التقارير الخاص بالشركة.\nلتفعيل حسابك، اضغط على الزر بالأسفل لمشاركة رقم هاتفك 📱',
  
  activationSuccess: (name) => `تم تفعيل حسابك بنجاح ✅\nأهلاً ${name}! يمكنك الآن إرسال تقاريرك.`,
  
  welcomeBack: (name) => `أهلاً بعودتك ${name} 👋\nاختر من القائمة بالأسفل للبدء:`,
  
  inactiveAccount: 'عذراً، تم إيقاف حسابك ⚠️\nيرجى التواصل مع الإدارة',
  
  // Report flows
  reportOpened: 'تم فتح تقرير جديد 🆕\nالآن أرسل:\n📸 الصور (يمكنك إرسال أكثر من صورة)\n🎤 رسالة صوتية\n📝 أو اكتب ملاحظة نصية\n\nعند الانتهاء اضغط ✅ إنهاء التقرير',
  
  photoReceived: (count) => `📸 تم استلام الصورة رقم ${count}\nيمكنك إرسال المزيد أو الضغط على ✅ إنهاء التقرير عند الانتهاء`,
  
  voiceReceived: '🎤 تم استلام الرسالة الصوتية ✅\nيمكنك إضافة المزيد أو الضغط على ✅ إنهاء التقرير',
  
  noteReceived: '📝 تم تسجيل ملاحظتك',
  
  noOpenTask: 'لا يوجد تقرير مفتوح حالياً 🤔\nاضغط على 🆕 تقرير جديد أولاً لبدء تقرير',
  
  emptyReportWarning: 'التقرير فارغ حالياً ⚠️\nأرسل صورة أو رسالة صوتية أو ملاحظة أولاً',
  
  reportSummary: (photoCount, voiceCount, hasText) => {
    const textLine = hasText ? 'يوجد ملاحظة نصية' : 'لا توجد ملاحظة';
    return `ملخص التقرير:\n📸 ${photoCount} صورة\n🎤 ${voiceCount} رسالة صوتية\n📝 ${textLine}\n\nهل تريد إرسال التقرير؟`;
  },
  
  reportSent: 'تم إرسال تقريرك بنجاح ✅ شكراً لك 🌟',
  
  reportCancelled: 'حسناً، يمكنك متابعة إضافة المزيد',
  
  // Existing task confirmation
  hasOpenTask: 'لديك تقرير مفتوح غير منته، هل تريد المتابعة فيه أم بدء تقرير جديد؟',
  
  resumeExisting: 'متابعة التقرير الحالي',
  
  startNew: 'بدء تقرير جديد',
  
  // My reports
  myReportsHeader: '📊 آخر تقاريرك:\n',
  
  reportLine: (date, photoCount, voiceCount, statusArabic) => 
    `${statusArabic} ${date} - ${photoCount} صورة، ${voiceCount} صوت`,
  
  statusInArabic: {
    unread: 'بانتظار المراجعة ⏳',
    received: 'تم الاستلام 📥',
    read: 'قيد المراجعة 👀',
    done: 'تمت المعالجة ✅'
  },
  
  // Help
  help: 'كيف يعمل البوت 🤖:\n\n1️⃣ اضغط 🆕 تقرير جديد للبدء\n2️⃣ أرسل الصور والرسائل الصوتية والملاحظات\n3️⃣ اضغط ✅ إنهاء التقرير عند الانتهاء\n4️⃣ يمكنك متابعة حالة تقاريرك من 📊 آخر تقاريري\n\nإذا واجهت أي مشكلة تواصل مع المحاسب مباشرة.',
  
  // Unrecognized input
  unrecognized: 'لم أفهم هذا الطلب 🤔\nيرجى استخدام الأزرار بالأسفل',
  
  // Inline button labels
  confirmSend: '✅ نعم، أرسل',
  cancelSend: '❌ إلغاء والمتابعة',
  
  // Button labels (for matching text handlers)
  buttons: {
    newReport: '🆕 تقرير جديد',
    finishReport: '✅ إنهاء التقرير',
    myReports: '📊 آخر تقاريري',
    help: 'ℹ️ مساعدة',
    sharePhone: '📱 مشاركة رقم الهاتف'
  }
};

module.exports = { messages };
