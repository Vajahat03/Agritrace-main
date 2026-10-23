import { Language } from '../types';

export interface TranslationDictionary {
  common: {
    appName: string;
    tagline: string;
    login: string;
    signup: string;
    logout: string;
    dashboard: string;
    language: string;
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    viewDetails: string;
    add: string;
    search: string;
    filter: string;
    status: string;
    date: string;
    quantity: string;
    price: string;
    weather: string;
    notifications: string;
    profile: string;
  };
  farmer: {
    title: string;
    myFarms: string;
    plots: string;
    myCrops: string;
    addCrop: string;
    cropVariety: string;
    plantingDate: string;
    expectedHarvest: string;
    fertilizerHistory: string;
    addFertilizer: string;
    irrigationHistory: string;
    addIrrigation: string;
    produceBatches: string;
    createBatch: string;
    logHarvest: string;
    batchCode: string;
    qrTrace: string;
  };
  vendor: {
    title: string;
    inventory: string;
    procurement: string;
    procureBatch: string;
    catalog: string;
    addProduct: string;
    orders: string;
    adjustStock: string;
  };
  customer: {
    title: string;
    marketplace: string;
    freshnessBag: string;
    rescanProduce: string;
    predictedShelfLife: string;
    useByDate: string;
    addToCart: string;
    cart: string;
    checkout: string;
    myOrders: string;
    favorites: string;
  };
  commodities: Record<string, string>;
}

export const dictionaries: Record<Language, TranslationDictionary> = {
  en: {
    common: {
      appName: 'AgriTrace',
      tagline: 'Multimodal Produce Freshness & Farm-to-Consumer Traceability',
      login: 'Log In',
      signup: 'Sign Up',
      logout: 'Log Out',
      dashboard: 'Dashboard',
      language: 'Language',
      loading: 'Loading...',
      save: 'Save Changes',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      viewDetails: 'View Details',
      add: 'Add New',
      search: 'Search...',
      filter: 'Filter',
      status: 'Status',
      date: 'Date',
      quantity: 'Quantity',
      price: 'Price',
      weather: 'Weather & Advisory',
      notifications: 'Notifications',
      profile: 'My Profile',
    },
    farmer: {
      title: 'Farmer Portal',
      myFarms: 'My Farms',
      plots: 'Field Plots',
      myCrops: 'Active Crops',
      addCrop: 'Plant New Crop',
      cropVariety: 'Variety',
      plantingDate: 'Planting Date',
      expectedHarvest: 'Expected Harvest',
      fertilizerHistory: 'Fertilizer History',
      addFertilizer: 'Record Fertilizer',
      irrigationHistory: 'Irrigation Logs',
      addIrrigation: 'Log Irrigation',
      produceBatches: 'Produce Batches',
      createBatch: 'Create Produce Batch',
      logHarvest: 'Log Harvest & Mint Batch',
      batchCode: 'Batch Code',
      qrTrace: 'Generate QR Label',
    },
    vendor: {
      title: 'Vendor Portal',
      inventory: 'Live Inventory',
      procurement: 'Batch Procurement',
      procureBatch: 'Procure from Farmer Batch',
      catalog: 'Product Listings',
      addProduct: 'Create Listing',
      orders: 'Customer Orders',
      adjustStock: 'Adjust Stock',
    },
    customer: {
      title: 'Customer Portal',
      marketplace: 'Fresh Produce Market',
      freshnessBag: 'Digital Freshness Bag',
      rescanProduce: 'Re-Scan Produce',
      predictedShelfLife: 'Estimated Shelf-Life',
      useByDate: 'Recommended Use-By Date',
      addToCart: 'Add to Cart',
      cart: 'Cart',
      checkout: 'Proceed to Checkout',
      myOrders: 'My Orders',
      favorites: 'Saved Favorites',
    },
    commodities: {
      TOMATO: 'Tomato',
      ONION: 'Onion',
      POTATO: 'Potato',
      CHILI: 'Green Chili',
      MANGO: 'Mango (Alphonso)',
      BANANA: 'Banana',
      APPLE: 'Apple',
      SPINACH: 'Spinach',
    },
  },
  hi: {
    common: {
      appName: 'एग्रीट्रेस (AgriTrace)',
      tagline: 'एआई-संचालित ताज़गी पहचान एवं खेत-से-उपभोक्ता ट्रेसिबिलिटी',
      login: 'लॉग इन करें',
      signup: 'साइन अप करें',
      logout: 'लॉग आउट',
      dashboard: 'डैशबोर्ड',
      language: 'भाषा (Language)',
      loading: 'लोड हो रहा है...',
      save: 'सुरक्षित करें',
      cancel: 'रद्द करें',
      delete: 'हटाएं',
      edit: 'संपादित करें',
      viewDetails: 'विवरण देखें',
      add: 'नया जोड़ें',
      search: 'खोजें...',
      filter: 'फ़िल्टर',
      status: 'स्थिति',
      date: 'दिनांक',
      quantity: 'मात्रा',
      price: 'कीमत',
      weather: 'मौसम एवं सलाह',
      notifications: 'सूचनाएं',
      profile: 'मेरी प्रोफाइल',
    },
    farmer: {
      title: 'किसान पोर्टल (Farmer Portal)',
      myFarms: 'मेरे खेत',
      plots: 'खेत के भूखंड (Plots)',
      myCrops: 'सक्रिय फसलें',
      addCrop: 'नई फसल जोड़ें',
      cropVariety: 'किस्म (Variety)',
      plantingDate: 'बुवाई की तारीख',
      expectedHarvest: 'अनुमानित कटाई',
      fertilizerHistory: 'खाद एवं उर्वरक इतिहास',
      addFertilizer: 'उर्वरक प्रयोग दर्ज करें',
      irrigationHistory: 'सिंचाई का विवरण',
      addIrrigation: 'सिंचाई दर्ज करें',
      produceBatches: 'उत्पाद बैच (Batches)',
      createBatch: 'बैच बनाएं',
      logHarvest: 'कटाई दर्ज करें एवं बैच बनाएं',
      batchCode: 'बैच कोड',
      qrTrace: 'QR कोड बनाएं',
    },
    vendor: {
      title: 'विक्रेता पोर्टल (Vendor Portal)',
      inventory: 'वर्तमान इन्वेंटरी',
      procurement: 'बैच खरीद (Procurement)',
      procureBatch: 'किसान बैच से खरीदें',
      catalog: 'मार्केट उत्पाद',
      addProduct: 'उत्पाद जोड़ें',
      orders: 'ग्राहक ऑर्डर',
      adjustStock: 'स्टॉक संशोधित करें',
    },
    customer: {
      title: 'उपभोक्ता पोर्टल (Customer Portal)',
      marketplace: 'ताज़ा उत्पाद बाज़ार',
      freshnessBag: 'डिजिटल फ्रेशनेस बैग',
      rescanProduce: 'पुनः स्कैन करें (Re-Scan)',
      predictedShelfLife: 'अनुमानित शेल्फ-लाइफ',
      useByDate: 'उपयोग की अंतिम अनुशंसित तिथि',
      addToCart: 'कार्ट में जोड़ें',
      cart: 'कार्ट',
      checkout: 'चेकआउट करें',
      myOrders: 'मेरे ऑर्डर',
      favorites: 'पसंदीदा उत्पाद',
    },
    commodities: {
      TOMATO: 'टमाटर (Tomato)',
      ONION: 'प्याज (Onion)',
      POTATO: 'आलू (Potato)',
      CHILI: 'हरी मिर्च (Chili)',
      MANGO: 'आम (Mango)',
      BANANA: 'केला (Banana)',
      APPLE: 'सेब (Apple)',
      SPINACH: 'पालक (Spinach)',
    },
  },
  mr: {
    common: {
      appName: 'अ‍ॅग्रीट्रेस (AgriTrace)',
      tagline: 'कृषी गुप्तवार्ता, ताजेपणा तपासणी व शेतापासून ग्राहकापर्यंत ट्रेसिबिलिटी',
      login: 'लॉग इन',
      signup: 'नोंदणी करा',
      logout: 'लॉग आऊट',
      dashboard: 'डॅशबोर्ड',
      language: 'भाषा',
      loading: 'लोड होत आहे...',
      save: 'जतन करा',
      cancel: 'रद्द करा',
      delete: 'हटवा',
      edit: 'बदला',
      viewDetails: 'तपशील पहा',
      add: 'नवीन जोडा',
      search: 'शोधा...',
      filter: 'फिल्टर',
      status: 'स्थिती',
      date: 'तारीख',
      quantity: 'प्रमाण',
      price: 'किंमत',
      weather: 'हवामान व कृषी सल्ला',
      notifications: 'सूचना',
      profile: 'माझी प्रोफाइल',
    },
    farmer: {
      title: 'शेतकरी पोर्टल (Farmer Portal)',
      myFarms: 'माझी शेती',
      plots: 'प्लॉट्स (Plots)',
      myCrops: 'सक्रिय पिके',
      addCrop: 'नवीन पीक नोंदवा',
      cropVariety: 'वाण / जात',
      plantingDate: 'लागवड तारीख',
      expectedHarvest: 'अपेक्षित काढणी',
      fertilizerHistory: 'खते व खत व्यवस्थापन इतिहास',
      addFertilizer: 'खत मात्रा नोंदवा',
      irrigationHistory: 'पाणी व सिंचन नोंद',
      addIrrigation: 'सिंचन नोंदवा',
      produceBatches: 'उत्पादन बॅचेस (Batches)',
      createBatch: 'बॅच तयार करा',
      logHarvest: 'काढणी नोंदवून बॅच तयार करा',
      batchCode: 'बॅच कोड',
      qrTrace: 'QR कोड तयार करा',
    },
    vendor: {
      title: 'विक्रेता पोर्टल (Vendor Portal)',
      inventory: 'साठा (Inventory)',
      procurement: 'थेट शेतकरी खरेदी',
      procureBatch: 'बॅच खरेदी करा',
      catalog: 'उत्पादने',
      addProduct: 'उत्पादन जोडा',
      orders: 'ऑर्डर्स',
      adjustStock: 'साठा बदला',
    },
    customer: {
      title: 'ग्राहक पोर्टल (Customer Portal)',
      marketplace: 'भाजीपाला व फळे बाजारपेठ',
      freshnessBag: 'डिजिटल फ्रेशनेस बॅग',
      rescanProduce: 'पुन्हा स्कॅन करा',
      predictedShelfLife: 'अपेक्षित ताजेपणा टिकण्याचा कालावधी',
      useByDate: 'वापरण्याची शिफारस तारीख',
      addToCart: 'कार्टमध्ये जोडा',
      cart: 'कार्ट',
      checkout: 'खरेदी पूर्ण करा',
      myOrders: 'माझ्या ऑर्डर्स',
      favorites: 'आवडती उत्पादने',
    },
    commodities: {
      TOMATO: 'टोमॅटो (Tomato)',
      ONION: 'कांदा (Onion)',
      POTATO: 'बटाटा (Potato)',
      CHILI: 'हिरवी मिरची (Chili)',
      MANGO: 'हापूस आंबा (Mango)',
      BANANA: 'केळी (Banana)',
      APPLE: 'सफरचंद (Apple)',
      SPINACH: 'पालक (Spinach)',
    },
  },
  ta: {
    common: {
      appName: 'அக்ரிட்ரேஸ் (AgriTrace)',
      tagline: 'பண்ணை முதல் நுகர்வோர் வரை கண்டறியும் தளம்',
      login: 'உள்நுழைய',
      signup: 'பதிவு செய்க',
      logout: 'வெளியேறு',
      dashboard: 'முகப்பு பலகை',
      language: 'மொழி',
      loading: 'ஏற்றுகிறது...',
      save: 'சேமிக்க',
      cancel: 'ரத்துசெய்',
      delete: 'நீக்கு',
      edit: 'திருத்து',
      viewDetails: 'விவரங்களை காண்க',
      add: 'புதியது சேர்க்க',
      search: 'தேடுக...',
      filter: 'வடிகட்டு',
      status: 'நிலை',
      date: 'தேதி',
      quantity: 'அளவு',
      price: 'விலை',
      weather: 'வானிலை ஆலோசனை',
      notifications: 'அறிவிப்புகள்',
      profile: 'சுயவிவரம்',
    },
    farmer: {
      title: 'விவசாயி தளம் (Farmer Portal)',
      myFarms: 'எனது பண்ணைகள்',
      plots: 'நிலப்பகுதிகள்',
      myCrops: 'பயிர்கள்',
      addCrop: 'புதிய பயிர் சேர்க்க',
      cropVariety: 'பயிர் ரகம்',
      plantingDate: 'நடவு தேதி',
      expectedHarvest: 'அறுவடை தேதி',
      fertilizerHistory: 'உர மேலாண்மை வரலாறு',
      addFertilizer: 'உர பயன்பாடு பதிவு',
      irrigationHistory: 'நீர்ப்பாசன பதிவு',
      addIrrigation: 'பாசனம் சேர்க்க',
      produceBatches: 'விளைபொருள் தொகுதிகள் (Batches)',
      createBatch: 'தொகுதி உருவாக்கு',
      logHarvest: 'அறுவடை பதிவு செய்க',
      batchCode: 'தொகுதி குறியீடு',
      qrTrace: 'QR குறியீடு',
    },
    vendor: {
      title: 'விற்பனையாளர் தளம் (Vendor Portal)',
      inventory: 'சரக்கு இருப்பு',
      procurement: 'கொள்முதல்',
      procureBatch: 'பண்ணை தொகுதி வாங்க',
      catalog: 'பொருட்கள் பட்டியல்',
      addProduct: 'பொருள் சேர்க்க',
      orders: 'ஆர்டர்கள்',
      adjustStock: 'இருப்பு மாற்றுக',
    },
    customer: {
      title: 'வாடிக்கையாளர் தளம் (Customer Portal)',
      marketplace: 'விளைபொருள் சந்தை',
      freshnessBag: 'டிஜிட்டல் புத்துணர்ச்சி பை',
      rescanProduce: 'மீண்டும் ஸ்கேன் செய்க',
      predictedShelfLife: 'ஆயுட்காலம் மதிப்பீடு',
      useByDate: 'பயன்படுத்த உகந்த தேதி',
      addToCart: 'கூடையில் சேர்க்க',
      cart: 'கூடை',
      checkout: 'செக் அவுட்',
      myOrders: 'எனது ஆர்டர்கள்',
      favorites: 'விருப்பங்கள்',
    },
    commodities: {
      TOMATO: 'தக்காளி (Tomato)',
      ONION: 'வெங்காயம் (Onion)',
      POTATO: 'உருளைக்கிழங்கு (Potato)',
      CHILI: 'பச்சை மிளகாய் (Chili)',
      MANGO: 'மாம்பழம் (Mango)',
      BANANA: 'வாழைப்பழம் (Banana)',
      APPLE: 'ஆப்பிள் (Apple)',
      SPINACH: 'கீரை (Spinach)',
    },
  },
  hinglish: {
    common: {
      appName: 'AgriTrace',
      tagline: 'AI Multimodal Freshness Detection aur Farm-to-Consumer Traceability',
      login: 'Log In',
      signup: 'Sign Up Karein',
      logout: 'Log Out',
      dashboard: 'Dashboard',
      language: 'Bhasha / Language',
      loading: 'Load ho raha hai...',
      save: 'Save Karein',
      cancel: 'Cancel',
      delete: 'Delete Karein',
      edit: 'Edit Karein',
      viewDetails: 'Details Dekhein',
      add: 'Naya Add Karein',
      search: 'Search karein...',
      filter: 'Filter',
      status: 'Status',
      date: 'Date / Tareekh',
      quantity: 'Quantity (Matra)',
      price: 'Price / Daam',
      weather: 'Mausam & Advisory',
      notifications: 'Alerts & Notifications',
      profile: 'My Profile',
    },
    farmer: {
      title: 'Kisan Portal (Farmer)',
      myFarms: 'Mera Farm / Khet',
      plots: 'Field Plots',
      myCrops: 'Active Faslein',
      addCrop: 'Nayi Fasal Lagayein',
      cropVariety: 'Variety / Kism',
      plantingDate: 'Planting Date',
      expectedHarvest: 'Kataai Ki Date',
      fertilizerHistory: 'Khaad & Fertilizer History',
      addFertilizer: 'Fertilizer Entry Add Karein',
      irrigationHistory: 'Pani & Sinchai Log',
      addIrrigation: 'Irrigation Add Karein',
      produceBatches: 'Produce Batches',
      createBatch: 'Batch Banayein',
      logHarvest: 'Harvest Record & Batch Mint',
      batchCode: 'Batch Code',
      qrTrace: 'QR Code Nikalein',
    },
    vendor: {
      title: 'Vendor Portal (Vyapari)',
      inventory: 'Dukaan / Stock Inventory',
      procurement: 'Farmer Batch Kharidi',
      procureBatch: 'Kisan se Batch Kharidein',
      catalog: 'Market Listings',
      addProduct: 'Product Add Karein',
      orders: 'Customer Orders',
      adjustStock: 'Stock Adjust Karein',
    },
    customer: {
      title: 'Customer Portal (Grahak)',
      marketplace: 'Taaza Sabzi & Phal Market',
      freshnessBag: 'Digital Freshness Bag',
      rescanProduce: 'Produce Phir se Scan Karein',
      predictedShelfLife: 'Kitne Din Taaza Rahega',
      useByDate: 'Use-By Date',
      addToCart: 'Cart me Daalein',
      cart: 'Mera Cart',
      checkout: 'Order Confirm Karein',
      myOrders: 'Mere Orders',
      favorites: 'Favorites List',
    },
    commodities: {
      TOMATO: 'Tamatar (Tomato)',
      ONION: 'Pyaaz (Onion)',
      POTATO: 'Aloo (Potato)',
      CHILI: 'Hari Mirchi (Chili)',
      MANGO: 'Aam (Alphonso Mango)',
      BANANA: 'Kela (Banana)',
      APPLE: 'Seb (Apple)',
      SPINACH: 'Palak (Spinach)',
    },
  },
};
