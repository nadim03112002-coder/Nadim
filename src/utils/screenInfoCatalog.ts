import type { AppLang } from "./appLang";

export interface ScreenGuideItem {
  name: string;
  desc: string;
}

export interface ScreenFeatureGuide {
  title: string;
  subtitle: string;
  items: ScreenGuideItem[];
  tip?: string;
}

type BilingualGuide = {
  HI: ScreenFeatureGuide;
  EN: ScreenFeatureGuide;
};

const ADMIN_GUIDES: Record<string, BilingualGuide> = {
  dashboard: {
    HI: {
      title: "होम डैशबोर्ड (स्कूल नियंत्रण केंद्र)",
      subtitle: "पूरे स्कूल की ताज़ा स्थिति, आज का सारांश, मुख्य कार्य और सभी मॉड्यूल एक ही स्थान पर।",
      items: [
        { name: "आज का कमांड सारांश व क्लोजिंग रिपोर्ट", desc: "आज की कुल फीस वसूली, अनुपस्थित छात्र, स्टाफ उपस्थिति और कल के फीस कॉल एक नज़र में देखें, सुनें या शेयर करें।" },
        { name: "मुख्य कार्य कार्ड", desc: "दैनिक हाज़िरी रजिस्टर, फीस जमा, फीस तगादा कॉलर और त्वरित छात्र प्रवेश सीधे यहाँ से खोलें।" },
        { name: "खोज व शीर्ष टूल्स", desc: "किसी भी छात्र, शिक्षक, रसीद या मॉड्यूल को तुरंत खोजें; रूटीन, ब्रांच, भाषा और सेटिंग्स ऊपर दिए गए हैं।" },
        { name: "खाता निर्देशिका", desc: "छात्रों, शिक्षकों, अकाउंटेंट, कक्षाओं और ड्राइवरों की कुल संख्या देखकर सीधे उनकी सूची खोलें।" },
      ],
      tip: "किसी भी पेज से वापस आने के लिए ऊपर होम या बैक बटन दबाएँ।",
    },
    EN: {
      title: "Home Dashboard (School Control Center)",
      subtitle: "Live school overview, today's command summary, core operations, and quick module launcher.",
      items: [
        { name: "Today's Command Brief & Closing Summary", desc: "View, listen to, or share today's fee collection, absent students, staff attendance, and tomorrow's fee calls." },
        { name: "Core Operation Cards", desc: "Open Daily Attendance, Fee Collection, Fee Follow-up Caller, and Quick Student Admission in one tap." },
        { name: "Universal Search & Header Tools", desc: "Find any student, teacher, receipt, or module instantly; access Timetable, Branch, Language, and Settings at the top." },
        { name: "Accounts Directory", desc: "View live counts for students, teachers, accountants, classes, and drivers and open their directories directly." },
      ],
      tip: "Use the top Home or Back button from any inner page to return to the dashboard.",
    },
  },
  fee_tagada: {
    HI: {
      title: "फीस तगादा कॉलर व अभिभावक कॉलर आईडी",
      subtitle: "बकाया फीस वाले परिवारों को प्राथमिकता से कॉल करें, वादा तिथि सहेजें और कॉलर आईडी चालू करें।",
      items: [
        { name: "बकाया राशि वॉइस (चालू/बंद)", desc: "कॉल आने पर आवाज़ में बकाया राशि बोलना चालू या बंद करें।" },
        { name: "पावर मोड (चालू/बंद)", desc: "एक कॉल सेव होते ही अगले बकाया परिवार को तुरंत कॉल करने के लिए तेज़ कतार चलाता है।" },
        { name: "अभिभावक कॉलर आईडी व टेस्ट बटन", desc: "इनकमिंग, आउटगोइंग और स्टाफ वॉइस टेस्ट बटन, फ्लोटिंग ओवरले तथा फोन कॉल लॉग यहाँ उपलब्ध हैं।" },
        { name: "स्मार्ट कॉल सूचियाँ", desc: "आज कॉल करें, कभी कॉल नहीं हुआ, वादा तिथि, पूर्ण जमा और कॉल इतिहास टैब से हर परिवार ट्रैक करें।" },
      ],
      tip: "अभिभावक कॉलर आईडी बटन दबाकर तुरंत टेस्ट इनकमिंग व टेस्ट आउटगोइंग प्रीव्यू जाँच सकते हैं।",
    },
    EN: {
      title: "Fee Follow-up Caller & Parent Caller ID",
      subtitle: "Call families with pending fees by priority, record promise dates, and manage Parent Caller ID.",
      items: [
        { name: "Due Amount Voice Toggle", desc: "Turn spoken pending fee announcements on or off for incoming parent calls." },
        { name: "Power Mode Toggle", desc: "Automatically advance to the next pending family right after saving a call outcome." },
        { name: "Parent Caller ID & Quick Tests", desc: "Test Incoming, Test Outgoing, and Test Staff Voice previews along with Floating Overlay and SIM Call Logs." },
        { name: "Smart Follow-up Queues", desc: "Track families across Call Today, Never Called, Promised, Settled, and Call History tabs." },
      ],
      tip: "Open Parent Caller ID to run instant Test Incoming or Test Outgoing popups anytime.",
    },
  },
  fees: {
    HI: {
      title: "कक्षावार फीस संकलन",
      subtitle: "किसी भी कक्षा की मासिक व सत्र फीस जमा करें, बकाया देखें, UPI स्वीकृति दें और रसीद निकालें।",
      items: [
        { name: "कक्षा चयन व खोज", desc: "कक्षा चुनकर या छात्र का नाम, पिता का नाम अथवा रोल नंबर खोजकर फीस सूची खोलें।" },
        { name: "त्वरित फीस जमा व छूट", desc: "मासिक शुल्क, बस शुल्क, विलंब शुल्क या छूट जोड़कर नकद, UPI या ऑनलाइन भुगतान दर्ज करें।" },
        { name: "UPI स्क्रीनशॉट स्वीकृति", desc: "अभिभावकों द्वारा अपलोड किए गए UPI भुगतान प्रमाण 1 क्लिक में जाँचें और रसीद जारी करें।" },
        { name: "रसीद व व्हाट्सएप साझाकरण", desc: "3-इंच थर्मल रसीद, A4 मांग पर्ची या PDF डाउनलोड कर अभिभावकों को भेजें।" },
      ],
    },
    EN: {
      title: "Class-Wise Fee Collection",
      subtitle: "Collect monthly and term fees, review pending dues, approve UPI proofs, and generate receipts.",
      items: [
        { name: "Class Selector & Search", desc: "Pick a class or search by student name, father's name, or roll number to open fee ledgers." },
        { name: "Quick Fee Deposit & Concession", desc: "Record Cash, UPI, or Online payments with transport charges, late fines, or discounts." },
        { name: "UPI Screenshot Approvals", desc: "Verify parent-uploaded UPI payment screenshots and UTR references in one click." },
        { name: "Receipts & WhatsApp Share", desc: "Print 3-inch thermal receipts, A4 demand slips, or export official PDF receipts." },
      ],
    },
  },
  fee_class: {
    HI: {
      title: "कक्षा फीस प्रबंधन",
      subtitle: "चुनी हुई कक्षा के सभी छात्रों का मासिक शुल्क खाता, रसीद प्रिंट और बकाया पर्चियाँ।",
      items: [
        { name: "खोज व फ़िल्टर", desc: "नाम या रोल नंबर से खोजें और जमा, आंशिक या बकाया छात्रों को अलग करें।" },
        { name: "फीस जमा बटन", desc: "आंशिक भुगतान, छूट और भुगतान माध्यम के साथ आधिकारिक रसीद बनाएँ।" },
        { name: "4-इन-1 बकाया पर्चियाँ", desc: "सभी बकाया छात्रों की मांग पर्चियाँ एक साथ A4 PDF में निकालें।" },
      ],
    },
    EN: {
      title: "Class Fee Manager",
      subtitle: "Monthly fee ledger, receipt printing, and bulk demand slips for the selected class.",
      items: [
        { name: "Search & Status Filter", desc: "Search by student name or roll number and filter Paid, Partial, or Unpaid records." },
        { name: "Collect Fee Action", desc: "Open the payment modal to record full or partial payments with concessions." },
        { name: "4-in-1 A4 Demand Slips", desc: "Generate printable A4 fee demand slips for all unpaid students at once." },
      ],
    },
  },
  fee_all: {
    HI: {
      title: "संपूर्ण स्कूल फीस रजिस्टर",
      subtitle: "पूरे स्कूल की सभी कक्षाओं की एक साथ फीस वसूली, बकाया सूची और भुगतान इतिहास।",
      items: [
        { name: "सभी कक्षाओं में खोज", desc: "नाम, पिता के नाम या मोबाइल नंबर से पूरे स्कूल में किसी भी छात्र को खोजें।" },
        { name: "UPI प्रमाण स्वीकृति व पर्चियाँ", desc: "लंबित UPI भुगतान प्रमाण स्वीकृत करें और बकाया पर्चियाँ डाउनलोड करें।" },
      ],
    },
    EN: {
      title: "All-School Fee Register",
      subtitle: "Unified fee collection, pending dues, and payment history across all school classes.",
      items: [
        { name: "School-Wide Search", desc: "Find any student across all classes by name, father's name, or mobile number." },
        { name: "UPI Approvals & Bulk Slips", desc: "Review pending UPI payment proofs and export bulk demand slips." },
      ],
    },
  },
  attendance: {
    HI: {
      title: "दैनिक छात्र हाज़िरी रजिस्टर",
      subtitle: "रोज़ाना उपस्थिति, अनुपस्थिति व अवकाश दर्ज करें, QR/फेस स्कैन देखें और अभिभावक सूचना भेजें।",
      items: [
        { name: "तिथि व कक्षा चयन", desc: "आज या किसी पिछली तिथि की कक्षावार हाज़िरी खोलें और संपादित करें।" },
        { name: "एक-टैप हाज़िरी व सहेजें", desc: "उपस्थित, अनुपस्थित या अवकाश चुनकर तुरंत हाज़िरी सुरक्षित करें।" },
        { name: "अनुपस्थिति अलर्ट व मासिक PDF", desc: "अनुपस्थित छात्रों के अभिभावकों को सूचना भेजें या पूरे माह का रजिस्टर डाउनलोड करें।" },
      ],
    },
    EN: {
      title: "Daily Student Attendance Register",
      subtitle: "Mark Present, Absent, or Leave, review QR/Face scans, and send parent alerts.",
      items: [
        { name: "Date & Class Selector", desc: "Open and update class-wise attendance for today or any previous date." },
        { name: "1-Tap Marking & Save", desc: "Mark Present, Absent, or Leave individually or bulk-mark the entire class." },
        { name: "Parent Alerts & Monthly Matrix", desc: "Notify parents of absent students and export monthly A4 attendance registers." },
      ],
    },
  },
  absentee: {
    HI: {
      title: "अनुपस्थित छात्र कार्रवाई केंद्र",
      subtitle: "आज स्कूल न आने वाले सभी छात्रों की कक्षावार सूची, कॉल कार्रवाई और अवकाश ट्रैकर।",
      items: [
        { name: "कक्षावार अनुपस्थित सूची", desc: "देखें आज कौन-कौन से छात्र अनुपस्थित हैं और किनके अवकाश स्वीकृत हैं।" },
        { name: "सीधा कॉल व व्हाट्सएप सूचना", desc: "अभिभावक को सीधे फोन करें या अनुपस्थिति संदेश भेजें।" },
      ],
    },
    EN: {
      title: "Absentee Action Center",
      subtitle: "Class-wise list of today's absent students with direct parent call and alert actions.",
      items: [
        { name: "Class-Wise Absent List", desc: "View absent students and see who already has an approved leave." },
        { name: "Direct Call & Alerts", desc: "Call parents directly or send instant absence alerts." },
      ],
    },
  },
  students: {
    HI: {
      title: "छात्र निर्देशिका व प्रोफ़ाइल",
      subtitle: "सभी नामांकित छात्रों की सूची, नया प्रवेश, प्रोफ़ाइल सुधार, भाई-बहन लिंक और पहचान पत्र QR।",
      items: [
        { name: "नया छात्र जोड़ें", desc: "फ़ोटो, माता-पिता विवरण, मोबाइल, कक्षा, बस मार्ग व शुल्क के साथ नया प्रवेश करें।" },
        { name: "खोज व कक्षा फ़िल्टर", desc: "नाम, प्रवेश संख्या, रोल नंबर या मोबाइल से तुरंत छात्र खोजें।" },
      ],
    },
    EN: {
      title: "Students Directory & Profiles",
      subtitle: "Manage all enrolled students, new admissions, profile edits, sibling links, and QR IDs.",
      items: [
        { name: "Add New Student", desc: "Enroll students with photo, parent details, class, transport route, and fee setup." },
        { name: "Search & Class Filter", desc: "Quickly filter or locate any student by name, admission number, or phone." },
      ],
    },
  },
  teachers: {
    HI: {
      title: "शिक्षक व स्टाफ निर्देशिका",
      subtitle: "शिक्षकों को जोड़ें, कक्षाएँ व विषय आवंटित करें और मोबाइल गोपनीयता सेट करें।",
      items: [
        { name: "शिक्षक जोड़ें व संपादित करें", desc: "योग्यता, फ़ोन, वेतन, कक्षा और लॉगिन विवरण सहेजें।" },
        { name: "व्यक्तिगत नंबर गोपनीयता", desc: "अभिभावकों से शिक्षकों का व्यक्तिगत मोबाइल नंबर छिपाने का विकल्प नियंत्रित करें।" },
      ],
    },
    EN: {
      title: "Teachers & Faculty Directory",
      subtitle: "Add faculty members, assign classes and subjects, and manage caller privacy controls.",
      items: [
        { name: "Add & Edit Teachers", desc: "Configure qualifications, phone numbers, salaries, and assigned classes." },
        { name: "Personal Number Privacy", desc: "Hide teachers' personal phone numbers from parent Caller ID views when needed." },
      ],
    },
  },
  nsta_broadcast: {
    HI: {
      title: "स्कूल मैसेंजर व अभिभावक संवाद",
      subtitle: "अभिभावकों, शिक्षकों और कक्षा समूहों के साथ सुरक्षित चैट, वॉइस नोट व सूचनाएँ साझा करें।",
      items: [
        { name: "कक्षा प्रसारण समूह", desc: "पूरी कक्षा को एक साथ गृहकार्य, सूचना या PDF भेजें।" },
        { name: "सीधा व्यक्तिगत संवाद", desc: "अभिभावकों या स्टाफ से सीधे चैट और ऑडियो संदेश भेजें।" },
      ],
    },
    EN: {
      title: "School Messenger & Parent Chat",
      subtitle: "Secure messaging, voice notes, and official fee/notice sharing with parents and staff.",
      items: [
        { name: "Class Broadcast Groups", desc: "Send homework, announcements, and PDFs to an entire class at once." },
        { name: "Direct 1-on-1 Chat", desc: "Message individual parents or staff members with text, attachments, and audio notes." },
      ],
    },
  },
  school_profile: {
    HI: {
      title: "स्कूल प्रोफ़ाइल, सुरक्षा पिन व ऐप सेटिंग्स",
      subtitle: "स्कूल विवरण, लोगो, अनइंस्टॉल सुरक्षा पिन, APK अपडेट लिंक और थीम बदलें।",
      items: [
        { name: "अनइंस्टॉल सुरक्षा पिन", desc: "पूरे स्कूल के लिए साझा सुरक्षा पिन सेट करें।" },
        { name: "APK अपडेट व थीम", desc: "नया ऐप संस्करण लिंक जोड़ें और सफ़ेद, नीली या काली थीम चुनें।" },
      ],
    },
    EN: {
      title: "School Profile, Security PIN & Settings",
      subtitle: "Manage school details, logo, uninstall security PIN, APK update link, and app theme.",
      items: [
        { name: "Uninstall Security PIN", desc: "Set a shared school Admin PIN for device uninstall protection." },
        { name: "APK Updates & Theme", desc: "Configure latest APK download URLs and switch between Blue, White, or Black themes." },
      ],
    },
  },
  qr_pay: {
    HI: {
      title: "स्कूल UPI QR व बैंक भुगतान केंद्र",
      subtitle: "स्कूल का आधिकारिक UPI ID सेट करें और त्वरित भुगतान QR बनाएँ।",
      items: [
        { name: "UPI ID सेटअप", desc: "आधिकारिक UPI ID सहेजें जो रसीदों व छात्र पोर्टल भुगतान में उपयोग होता है।" },
        { name: "राशि के साथ QR", desc: "निर्धारित राशि का UPI QR बनाकर अभिभावकों के साथ साझा करें।" },
      ],
    },
    EN: {
      title: "School UPI QR & Bank Pay Desk",
      subtitle: "Configure the school's official UPI ID and generate instant payment QR codes.",
      items: [
        { name: "UPI ID Setup", desc: "Save the official school UPI ID used on fee slips and student payment portals." },
        { name: "Custom Amount QR", desc: "Generate and share a pre-filled UPI QR link with parents via WhatsApp." },
      ],
    },
  },
  online_admission_fee: {
    HI: {
      title: "ऑनलाइन भुगतान (Razorpay) व प्रवेश शुल्क",
      subtitle: "ऑनलाइन फीस व प्रवेश शुल्क के लिए Razorpay गेटवे और निश्चित राशि लॉक सेट करें।",
      items: [
        { name: "गेटवे कुंजी व वेबहुक", desc: "Razorpay Key व Secret जोड़कर 100% राशि लॉक के साथ स्वचालित रसीद चालू करें।" },
        { name: "प्रवेश फॉर्म शुल्क", desc: "ऑनलाइन प्रवेश आवेदन के समय ली जाने वाली राशि निर्धारित करें।" },
      ],
    },
    EN: {
      title: "Online Payment (Razorpay) & Admission Fee",
      subtitle: "Configure Razorpay keys for 100% amount-locked online fee and admission payments.",
      items: [
        { name: "Gateway Keys & Webhook", desc: "Add Razorpay credentials for strict amount locking and automatic fee receipts." },
        { name: "Admission Form Fee", desc: "Configure fees collected during online admission submissions." },
      ],
    },
  },
};

const TEACHER_GUIDES: Record<string, BilingualGuide> = {
  dashboard: {
    HI: {
      title: "शिक्षक डैशबोर्ड (अकादमिक पोर्टल)",
      subtitle: "आपकी आवंटित कक्षाएँ, आज की हाज़िरी, गृहकार्य, कॉलर आईडी और शिक्षण टूल्स।",
      items: [
        { name: "कॉलर आईडी व गोपनीयता", desc: "एक टैप में कॉलर आईडी चालू करें और चाहें तो अपना व्यक्तिगत नंबर अभिभावकों से छिपाएँ।" },
        { name: "कक्षा व आज के कार्य", desc: "अपनी कक्षाओं की हाज़िरी लगाएँ, गृहकार्य भेजें और अंक दर्ज करें।" },
        { name: "वॉकी-टॉकी व समय-सारिणी", desc: "शीर्ष बार से स्कूल वॉकी-टॉकी और आज की कक्षा समय-सारिणी देखें।" },
      ],
      tip: "किसी भी पेज से वापस आने के लिए ऊपर बैक बटन दबाएँ।",
    },
    EN: {
      title: "Teacher Dashboard (Faculty Portal)",
      subtitle: "Your assigned classes, daily attendance, homework, Caller ID setup, and teaching tools.",
      items: [
        { name: "Caller ID & Number Privacy", desc: "Enable Caller ID in one tap and optionally hide your personal phone number from parents." },
        { name: "Classes & Daily Tasks", desc: "Mark class attendance, assign homework, and enter exam marks directly." },
        { name: "Walkie-Talkie & Timetable", desc: "Open the school Walkie-Talkie and today's teaching schedule from the header." },
      ],
      tip: "Use the top Back button anytime to return to your dashboard.",
    },
  },
  attendance: ADMIN_GUIDES.attendance,
  absentee: ADMIN_GUIDES.absentee,
  homework: {
    HI: {
      title: "दैनिक गृहकार्य व कक्षा डायरी",
      subtitle: "आज का गृहकार्य, फ़ोटो व PDF जोड़कर तुरंत अभिभावकों तक भेजें।",
      items: [
        { name: "गृहकार्य भेजें", desc: "कक्षा, विषय और विवरण लिखकर प्रकाशित करें।" },
        { name: "जमा स्थिति देखें", desc: "देखें किन छात्रों ने गृहकार्य पूरा कर लिया है।" },
      ],
    },
    EN: {
      title: "Daily Homework & Class Diary",
      subtitle: "Publish daily homework with attached photos or PDFs straight to parents.",
      items: [
        { name: "Assign Homework", desc: "Select class and subject, write instructions, and publish immediately." },
        { name: "Submission Tracker", desc: "Review which students have completed and submitted their homework." },
      ],
    },
  },
  profile: {
    HI: {
      title: "शिक्षक प्रोफ़ाइल व नंबर गोपनीयता",
      subtitle: "अपना विवरण, पासवर्ड और अभिभावकों से नंबर छिपाने की सेटिंग बदलें।",
      items: [
        { name: "नंबर गोपनीयता स्विच", desc: "इसे चालू करने पर अभिभावकों को आपका व्यक्तिगत मोबाइल नंबर नहीं दिखेगा।" },
        { name: "कॉलर आईडी टेस्ट", desc: "इनकमिंग, आउटगोइंग और वॉइस अलर्ट का तुरंत परीक्षण करें।" },
      ],
    },
    EN: {
      title: "Teacher Profile & Number Privacy",
      subtitle: "Manage your profile details, recovery credentials, and Caller ID privacy settings.",
      items: [
        { name: "Hide Personal Number", desc: "Enable this toggle so parents do not see your personal mobile number." },
        { name: "Caller ID Tests", desc: "Preview incoming, outgoing, and voice alerts directly from this page." },
      ],
    },
  },
};

const ACCOUNTANT_GUIDES: Record<string, BilingualGuide> = {
  home: {
    HI: {
      title: "अकाउंटेंट होम डैशबोर्ड",
      subtitle: "आज की कुल नकद/ऑनलाइन वसूली, लंबित UPI स्वीकृतियाँ, बकाया और काउंटर टूल्स।",
      items: [
        { name: "आज की वसूली का सारांश", desc: "आज कुल कितनी फीस जमा हुई, कितना नकद व कितना UPI आया यह लाइव देखें।" },
        { name: "त्वरित काउंटर कार्य", desc: "1 क्लिक में फीस जमा, UPI प्रमाण स्वीकृति, फीस तगादा, रोकड़ बही या खर्च वाउचर खोलें।" },
      ],
    },
    EN: {
      title: "Accountant Desk Home",
      subtitle: "Live daily Cash/UPI fee summary, pending UPI approvals, dues, and counter tools.",
      items: [
        { name: "Today's Collection Summary", desc: "Track total fee collections split between Cash and Online/UPI in real time." },
        { name: "Quick Counter Actions", desc: "Open Fee Collection, UPI Approvals, Fee Caller, Cashbook, or Expense Vouchers in one click." },
      ],
    },
  },
  counter: {
    HI: {
      title: "त्वरित फीस काउंटर व रसीद",
      subtitle: "छात्र का नाम या रोल नंबर खोजकर सेकंडों में फीस काटें और 3-इंच थर्मल रसीद प्रिंट करें।",
      items: [
        { name: "तुरंत छात्र खोज", desc: "छात्र का नाम, प्रवेश संख्या या मोबाइल नंबर लिखकर बकाया विवरण देखें।" },
        { name: "रसीद प्रिंट व शेयर", desc: "भुगतान लेते ही थर्मल या A4 रसीद प्रिंट और व्हाट्सएप करें।" },
      ],
    },
    EN: {
      title: "Quick Fee Counter & 3\" POS Receipt",
      subtitle: "Search any student and issue a thermal or A4 receipt within seconds.",
      items: [
        { name: "Instant Student Search", desc: "Look up students by name, admission number, or phone to view dues." },
        { name: "Print & Share Receipt", desc: "Print 3-inch POS or A4 receipts and share directly on WhatsApp." },
      ],
    },
  },
  fee_collection: ADMIN_GUIDES.fees,
  fee_tagada: ADMIN_GUIDES.fee_tagada,
  qr_pay: ADMIN_GUIDES.qr_pay,
};

const STUDENT_GUIDES: Record<string, BilingualGuide> = {
  overview: {
    HI: {
      title: "छात्र व अभिभावक होम पोर्टल",
      subtitle: "बच्चे की आज की हाज़िरी, बकाया फीस, परीक्षा परिणाम, मिस्ड स्कूल कॉल और सभी सुविधाएँ।",
      items: [
        { name: "त्वरित लाइव आँकड़े", desc: "हाज़िरी प्रतिशत, बकाया फीस और ताज़ा परिणाम पर टैप करके सीधे उस अनुभाग में जाएँ।" },
        { name: "कॉलर आईडी व मिस्ड कॉल अलर्ट", desc: "स्कूल कॉलर आईडी चालू करें ताकि शिक्षक या स्कूल का कॉल आने पर तुरंत नाम दिखे।" },
        { name: "सभी मुख्य कार्ड", desc: "गृहकार्य, सूचनाएँ, फीस पासबुक, पहचान पत्र, लाइव बस व प्रश्न बैंक यहाँ से खोलें।" },
      ],
      tip: "शीर्ष पर दिए 🌐 बटन से आप कभी भी पूरी भाषा हिंदी या English में बदल सकते हैं।",
    },
    EN: {
      title: "Student & Parent Home Portal",
      subtitle: "View attendance, pending fees, exam results, missed school calls, and all campus tools.",
      items: [
        { name: "Quick Live Stats", desc: "Tap Attendance %, Fee Dues, or Latest Result at the top to jump straight to details." },
        { name: "Verified School Caller ID", desc: "Enable Caller ID so calls from teachers and school staff show verified names." },
        { name: "Campus Feature Grid", desc: "Access Homework, Notices, Fee Passbook, Digital ID Card, Live Bus, and Question Bank." },
      ],
      tip: "Use the 🌐 button at the top anytime to switch between Hindi and English.",
    },
  },
  fees: {
    HI: {
      title: "फीस पासबुक, ऑनलाइन भुगतान व रसीद",
      subtitle: "जमा फीस, बकाया माह, UPI स्क्रीनशॉट अपलोड और आधिकारिक रसीद डाउनलोड करें।",
      items: [
        { name: "ऑनलाइन व UPI QR भुगतान", desc: "Razorpay या स्कूल के UPI QR से भुगतान करके स्क्रीनशॉट व UTR नंबर अपलोड करें।" },
        { name: "रसीद व मांग पर्ची PDF", desc: "हर जमा फीस की आधिकारिक रसीद और बकाया मांग पर्ची कभी भी डाउनलोड करें।" },
      ],
    },
    EN: {
      title: "Fee Passbook, Online Pay & Receipts",
      subtitle: "Track paid/pending months, pay via Razorpay or UPI QR screenshot, and download receipts.",
      items: [
        { name: "Online & UPI QR Payment", desc: "Pay securely via Razorpay or scan the School UPI QR and upload your screenshot + UTR." },
        { name: "Receipts & Demand Slips", desc: "Download official paid receipts and fee demand slips as PDF anytime." },
      ],
    },
  },
  attendance: {
    HI: {
      title: "हाज़िरी कैलेंडर व अवकाश आवेदन",
      subtitle: "मासिक उपस्थिति, अनुपस्थिति रिपोर्ट देखें और ऑनलाइन अवकाश आवेदन भेजें।",
      items: [
        { name: "मासिक कैलेंडर", desc: "हर तिथि पर उपस्थित, अनुपस्थित या अवकाश की स्थिति देखें।" },
        { name: "अवकाश आवेदन", desc: "बच्चे की छुट्टी के लिए कारण व तिथि चुनकर शिक्षक को भेजें।" },
      ],
    },
    EN: {
      title: "Attendance Calendar & Leave Request",
      subtitle: "Review monthly present/absent records and submit parent leave applications.",
      items: [
        { name: "Monthly Calendar", desc: "See day-by-day Present, Absent, and Leave status across the session." },
        { name: "Apply for Leave", desc: "Submit leave dates and reason directly to the class teacher." },
      ],
    },
  },
  exams: {
    HI: {
      title: "परीक्षा परिणाम व अंकपत्र",
      subtitle: "सभी परीक्षाओं के विषयवार अंक, ग्रेड और प्रतिशत यहाँ देखें।",
      items: [
        { name: "परीक्षा व विषयवार अंक", desc: "चयनित परीक्षा के सभी विषयों के अंक व कुल परिणाम देखें।" },
      ],
    },
    EN: {
      title: "Exam Results & Report Cards",
      subtitle: "Check subject-wise marks, grades, and percentages across all exams.",
      items: [
        { name: "Exam Marks Breakdown", desc: "Select any exam term to inspect subject scores and total percentage." },
      ],
    },
  },
  homework: TEACHER_GUIDES.homework,
  notices: {
    HI: {
      title: "स्कूल सूचना पट्ट",
      subtitle: "स्कूल की सभी महत्वपूर्ण सूचनाएँ, परीक्षा तिथियाँ और अवकाश घोषणाएँ।",
      items: [
        { name: "नवीनतम व पिन सूचनाएँ", desc: "महत्वपूर्ण परिपत्र और तिथिवार सूचनाएँ पढ़ें।" },
      ],
    },
    EN: {
      title: "School Notices & Circulars",
      subtitle: "Read all important school announcements, exam schedules, and holiday notices.",
      items: [
        { name: "Pinned & Latest Notices", desc: "Browse categorized school circulars and announcements." },
      ],
    },
  },
  idcard: {
    HI: {
      title: "डिजिटल QR छात्र पहचान पत्र",
      subtitle: "स्कूल गेट हाज़िरी और त्वरित लॉगिन के लिए आधिकारिक QR पहचान पत्र।",
      items: [
        { name: "लाइव QR कार्ड", desc: "गेट स्कैन और स्कूल सत्यापन के लिए यह डिजिटल कार्ड दिखाएँ।" },
      ],
    },
    EN: {
      title: "Digital QR Student ID Card",
      subtitle: "Official QR-enabled student identity card for gate attendance and instant login.",
      items: [
        { name: "Live QR ID Card", desc: "Present this digital card for gate QR attendance and library/bus verification." },
      ],
    },
  },
  profile: {
    HI: {
      title: "छात्र प्रोफ़ाइल, भाई-बहन व सेटिंग्स",
      subtitle: "छात्र विवरण, भाई-बहन खाता स्विच, कॉलर आईडी और थीम सेटिंग्स।",
      items: [
        { name: "भाई-बहन खाता बदलें", desc: "एक ही परिवार के अन्य बच्चों के खाते में 1 टैप में स्विच करें।" },
        { name: "थीम व कॉलर आईडी", desc: "सफ़ेद, नीली या काली थीम चुनें और स्कूल कॉलर आईडी चालू रखें।" },
      ],
    },
    EN: {
      title: "Student Profile, Siblings & Settings",
      subtitle: "Manage student details, linked sibling accounts, Caller ID, and app themes.",
      items: [
        { name: "Switch Sibling Account", desc: "Switch between siblings enrolled in the same school in one tap." },
        { name: "Theme & Caller ID", desc: "Choose White, Blue, or Black theme and manage Verified School Caller ID." },
      ],
    },
  },
};

const SPECIAL_GUIDES: Record<string, BilingualGuide> = {
  super_admin: {
    HI: {
      title: "सुपर एडमिन नियंत्रण पैनल",
      subtitle: "सभी पंजीकृत स्कूल, योजनाएँ, APK सेटिंग्स और मुख्य ब्रांडिंग प्रबंधित करें।",
      items: [
        { name: "स्कूल व राजस्व सारांश", desc: "सक्रिय स्कूल, कुल छात्र और वार्षिक राजस्व एक नज़र में देखें।" },
        { name: "स्कूल प्रबंधन", desc: "किसी भी स्कूल का प्लान बढ़ाएँ या एडमिन पैनल खोलें।" },
      ],
    },
    EN: {
      title: "Super Admin Control Panel",
      subtitle: "Manage all registered schools, subscription plans, APK updates, and global settings.",
      items: [
        { name: "Schools & Revenue Stats", desc: "Monitor active schools, total students, and plan subscriptions." },
        { name: "School Management", desc: "Extend school plans, update permissions, or open any school Admin ERP." },
      ],
    },
  },
  driver_console: {
    HI: {
      title: "ड्राइवर लाइव GPS बस कंसोल",
      subtitle: "स्कूल बस मार्ग पर लाइव GPS ट्रैकिंग शुरू करें ताकि अभिभावक बस की लोकेशन देख सकें।",
      items: [
        { name: "ट्रिप शुरू / बंद करें", desc: "यात्रा शुरू करते ही अभिभावकों को लाइव बस स्थान और स्टॉप अलर्ट मिलते हैं।" },
      ],
    },
    EN: {
      title: "Driver GPS Live Trip Console",
      subtitle: "Stream live GPS bus location so parents and school staff can track arrivals.",
      items: [
        { name: "Start / Stop Live Trip", desc: "Starting a trip shares real-time bus coordinates and stop proximity alerts." },
      ],
    },
  },
};

function formatViewTitle(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getScreenFeatureGuide(
  portal: "admin" | "teacher" | "accountant" | "student" | "super_admin" | "driver",
  screenKey: string,
  lang: AppLang = "HI"
): ScreenFeatureGuide {
  const pick = (g: BilingualGuide): ScreenFeatureGuide => (lang === "EN" ? g.EN : g.HI);

  if (portal === "super_admin") return pick(SPECIAL_GUIDES.super_admin);
  if (portal === "driver") return pick(SPECIAL_GUIDES.driver_console);
  if (portal === "admin" && ADMIN_GUIDES[screenKey]) return pick(ADMIN_GUIDES[screenKey]);
  if (portal === "teacher" && TEACHER_GUIDES[screenKey]) return pick(TEACHER_GUIDES[screenKey]);
  if (portal === "accountant" && ACCOUNTANT_GUIDES[screenKey]) return pick(ACCOUNTANT_GUIDES[screenKey]);
  if (portal === "student" && STUDENT_GUIDES[screenKey]) return pick(STUDENT_GUIDES[screenKey]);

  if (ADMIN_GUIDES[screenKey]) return pick(ADMIN_GUIDES[screenKey]);
  if (TEACHER_GUIDES[screenKey]) return pick(TEACHER_GUIDES[screenKey]);
  if (ACCOUNTANT_GUIDES[screenKey]) return pick(ACCOUNTANT_GUIDES[screenKey]);
  if (STUDENT_GUIDES[screenKey]) return pick(STUDENT_GUIDES[screenKey]);

  const readable = formatViewTitle(screenKey);
  if (lang === "EN") {
    return {
      title: readable,
      subtitle: `Quick guide for all tools and controls available on ${readable}.`,
      items: [
        { name: "Main Workspace & Controls", desc: `All records, forms, and action buttons for ${readable} appear here.` },
        { name: "Search, Filter & Export", desc: "Filter entries, update details, and export PDFs or receipts as needed." },
        { name: "Back Navigation", desc: "Use the top Home or Back button to return to the main dashboard." },
      ],
    };
  }

  return {
    title: readable,
    subtitle: `${readable} स्क्रीन पर उपलब्ध सभी विकल्पों और बटनों की संक्षिप्त जानकारी।`,
    items: [
      { name: "मुख्य कार्यक्षेत्र", desc: `${readable} से जुड़ी सभी प्रविष्टियाँ, फ़िल्टर और सहेजने के विकल्प यहाँ दिए गए हैं।` },
      { name: "खोज, फ़िल्टर व निर्यात", desc: "आवश्यकता के अनुसार रिकॉर्ड खोजें, सुधारें और PDF या रसीद निकालें।" },
      { name: "वापस जाएँ", desc: "कार्य पूरा होने पर ऊपर होम या बैक बटन से मुख्य डैशबोर्ड पर लौटें।" },
    ],
  };
}
