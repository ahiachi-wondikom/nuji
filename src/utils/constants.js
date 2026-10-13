export const languages = [
  { name: 'Igbo', native: 'Asụsụ Igbo', sample: 'Kedu ka ị dị taa?', color: 'green' },
  { name: 'Yoruba', native: 'Èdè Yorùbá', sample: 'Bawo ni ọjọ́ rẹ?', color: 'green' },
  { name: 'Hausa', native: 'Harshen Hausa', sample: 'Yaya ake yi yau?', color: 'green' },
  { name: 'Pidgin', native: 'Naija Pidgin', sample: 'How you dey today?', color: 'green' },
];

export const FALLBACK_RANKS = [];
export const FALLBACK_STATES = [];

export const zones = ['All States', 'South East', 'South West', 'South South', 'North Central', 'North East', 'North West'];

export const pointRules = { text: 3, voice: 5, both: 8, mix: 3 };

export const formalityLevels = ['Very Casual', 'Normal', 'Formal'];

export const exampleResponses = [
  "Nna men! Where you dey? E don tey — kedu ka i mere? Hope everything dey okay sha.",
  "Biko come help me carry this thing, my body no fit again — agwuola m ike!",
  "Oya let's go! Time waits for no one — anyi gaghi abia oge!",
];

// ---------- Nigerian phone helpers ----------
export const normalizeNaija = (p) => {
  let d = String(p || '').replace(/[\s-]/g, '');
  if (d.startsWith('+234')) d = '0' + d.slice(4);
  else if (d.startsWith('234')) d = '0' + d.slice(3);
  return d;
};
export const validNaijaPhone = (p) => /^0(70|80|81|90|91|93)\d{8}$/.test(p);

// ---------- cookie session helpers ----------
export const getCookie = () => { const m = document.cookie.match(/(?:^|; )nuji_phone=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };
export const setCookie = (v) => { document.cookie = `nuji_phone=${encodeURIComponent(v)}; path=/; max-age=31536000; SameSite=Lax`; };
export const clearCookie = () => { document.cookie = 'nuji_phone=; path=/; max-age=0'; };

export const FALLBACK_BADGES = [
  { category: 'Getting Started', icon: '🎙️', name: 'First Voice', desc: 'Made your first contribution', earned: true },
  { category: 'Volume', icon: '🔥', name: 'On Fire', desc: '10 contributions submitted', earned: true },
  { category: 'Volume', icon: '💪', name: 'Dedicated', desc: '50 contributions submitted', earned: false },
  { category: 'Volume', icon: '🏆', name: 'Champion', desc: '100 contributions submitted', earned: false },
  { category: 'Voice', icon: '🎤', name: 'Voice Hero', desc: '20 voice recordings submitted', earned: false },
  { category: 'Language', icon: '🦅', name: 'Igbo Pride', desc: '20 Igbo contributions', earned: false },
  { category: 'Language', icon: '⭐', name: 'Yoruba Star', desc: '20 Yoruba contributions', earned: false },
  { category: 'Language', icon: '🌙', name: 'Arewa Champion', desc: '20 Hausa contributions', earned: false },
  { category: 'Language', icon: '👑', name: 'Pidgin King', desc: '20 Pidgin contributions', earned: true },
  { category: 'Code Switch', icon: '🔀', name: 'Language Mixer', desc: 'First code-switched submission', earned: true },
  { category: 'Code Switch', icon: '🌍', name: 'Multilingual Master', desc: 'Code-switched in 3+ languages', earned: true },
  { category: 'Streaks', icon: '📅', name: '7 Day Streak', desc: 'Contributed 7 days in a row', earned: false },
  { category: 'Streaks', icon: '️', name: 'Two Week Warrior', desc: '14 day streak', earned: false },
  { category: 'Streaks', icon: '🌟', name: 'Monthly Legend', desc: 'Contributed 30 days in a row', earned: false },
  { category: 'Community', icon: '👥', name: 'Reviewer', desc: 'Reviewed 10 submissions', earned: true },
  { category: 'Community', icon: '🧓', name: 'Elder', desc: 'Reviewed 50 submissions', earned: false },
  { category: 'Community', icon: '🤝', name: 'Village Champion', desc: 'Referred 5 contributors', earned: false },
  { category: 'Points', icon: '⭐', name: 'Top Scorer', desc: 'Earned 100 points', earned: true },
  { category: 'Special', icon: '🐦', name: 'Early Bird', desc: 'One of the first 100 contributors', earned: true },
];

export const recentWeeks = [0,1,0,0,0, 0,2,0,1,0, 0,1,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,1,0];

// Nigeria's 36 states + FCT with LGAs
export const nigeriaStates = {
  'Abia': ['Aba North','Aba South','Arochukwu','Bende','Ikwuano','Isiala Ngwa North','Isiala Ngwa South','Isuikwuato','Obi Ngwa','Ohafia','Osisioma','Ugwunagbo','Ukwa East','Ukwa West','Umuahia North','Umuahia South','Umu Nneochi'],
  'Adamawa': ['Demsa','Fufure','Ganye','Gayuk','Gombi','Grie','Hong','Jada','Lamurde','Madagali','Maiha','Mayo Belwa','Michika','Mubi North','Mubi South','Numan','Shelleng','Song','Toungo','Yola North','Yola South'],
  'Akwa Ibom': ['Abak','Eastern Obolo','Eket','Esit Eket','Essien Udim','Etim Ekpo','Etinan','Ibeno','Ibesikpo Asutan','Ibiono Ibom','Ika','Ikono','Ikot Abasi','Ikot Ekpene','Ini','Itu','Mbo','Mkpat Enin','Nsit Atai','Nsit Ibom','Nsit Ubium','Obot Akara','Okobo','Onna','Oron','Oruk Anam','Udung Uko','Ukanafun','Uruan','Urue-Offong/Oruko','Uyo'],
  'Anambra': ['Aguata','Anambra East','Anambra West','Anaocha','Awka North','Awka South','Ayamelum','Dunukofia','Ekwusigo','Idemili North','Idemili South','Ihiala','Njikoka','Nnewi North','Nnewi South','Ogbaru','Onitsha North','Onitsha South','Orumba North','Orumba South','Oyi'],
  'Bauchi': ['Alkaleri','Bauchi','Bogoro','Damban','Darazo','Dass','Gamawa','Ganjuwa','Giade','Itas/Gadau',"Jama'are",'Katagum','Kirfi','Misau','Ningi','Shira','Tafawa Balewa','Toro','Warji','Zaki'],
  'Bayelsa': ['Brass','Ekeremor','Kolokuma/Opokuma','Nembe','Ogbia','Sagbama','Southern Ijaw','Yenagoa'],
  'Benue': ['Ado','Agatu','Apa','Buruku','Gboko','Guma','Gwer East','Gwer West','Katsina-Ala','Konshisha','Kwande','Logo','Makurdi','Obi','Ogbadibo','Ohimini','Oju','Okpokwu','Otukpo','Tarka','Ukum','Ushongo','Vandeikya'],
  'Borno': ['Abadam','Askira/Uba','Bama','Bayo','Biu','Chibok','Damboa','Dikwa','Gubio','Guzamala','Gwoza','Hawul','Jere','Kaga','Kala/Balge','Konduga','Kukawa','Kwaya Kusar','Mafa','Magumeri','Maiduguri','Marte','Mobbar','Monguno','Ngala','Nganzai','Shani'],
  'Cross River': ['Abi','Akamkpa','Akpabuyo','Bakassi','Bekwarra','Biase','Boki','Calabar Municipal','Calabar South','Etung','Ikom','Obanliku','Obubra','Obudu','Odukpani','Ogoja','Yakuur','Yala'],
  'Delta': ['Aniocha North','Aniocha South','Bomadi','Burutu','Ethiope East','Ethiope West','Ika North East','Ika South','Isoko North','Isoko South','Ndokwa East','Ndokwa West','Okpe','Oshimili North','Oshimili South','Patani','Sapele','Udu','Ughelli North','Ughelli South','Ukwuani','Uvwie','Warri North','Warri South','Warri South West'],
  'Ebonyi': ['Abakaliki','Afikpo North','Afikpo South','Ebonyi','Ezza North','Ezza South','Ikwo','Ishielu','Ivo','Izzi','Ohaozara','Ohaukwu','Onicha'],
  'Edo': ['Akoko-Edo','Egor','Esan Central','Esan North-East','Esan South-East','Esan West','Etsako Central','Etsako East','Etsako West','Igueben','Ikpoba-Okha','Orhionmwon','Oredo','Ovia North-East','Ovia South-West','Owan East','Owan West','Uhunmwonde'],
  'Ekiti': ['Ado Ekiti','Efon','Ekiti East','Ekiti South-West','Ekiti West','Emure','Gbonyin','Ido Osi','Ijero','Ikere','Ikole','Ilejemeje','Irepodun/Ifelodun','Ise/Orun','Moba','Oye'],
  'Enugu': ['Aninri','Awgu','Enugu East','Enugu North','Enugu South','Ezeagu','Igbo Etiti','Igbo Eze North','Igbo Eze South','Isi Uzo','Nkanu East','Nkanu West','Nsukka','Oji River','Udenu','Udi','Uzo Uwani'],
  'FCT': ['Abaji','Abuja Municipal','Bwari','Gwagwalada','Kuje','Kwali'],
  'Gombe': ['Akko','Balanga','Billiri','Dukku','Funakaye','Gombe','Kaltungo','Kwami','Nafada','Shongom','Yamaltu/Deba'],
  'Imo': ['Aboh Mbaise','Ahiazu Mbaise','Ehime Mbano','Ezinihitte','Ideato North','Ideato South','Ihitte/Uboma','Ikeduru','Isiala Mbano','Isu','Mbaitoli','Ngor Okpala','Njaba','Nkwerre','Nwangele','Obowo','Oguta','Ohaji/Egbema','Okigwe','Orlu','Orsu','Oru East','Oru West','Owerri Municipal','Owerri North','Owerri West','Unuimo'],
  'Jigawa': ['Auyo','Babura','Biriniwa','Birnin Kudu','Buji','Dutse','Gagarawa','Garki','Gumel','Guri','Gwaram','Gwiwa','Hadejia','Jahun','Kafin Hausa','Kaugama','Kazaure','Kiri Kasama','Kiyawa','Maigatari','Malam Madori','Miga','Ringim','Roni','Sule Tankarkar','Taura','Yankwashi'],
  'Kaduna': ['Birnin Gwari','Chikun','Giwa','Igabi','Ikara','Jaba',"Jema'a",'Kachia','Kaduna North','Kaduna South','Kagarko','Kajuru','Kaura','Kauru','Kubau','Kudan','Lere','Makarfi','Sabon Gari','Sanga','Soba','Zangon Kataf','Zaria'],
  'Kano': ['Ajingi','Albasu','Bagwai','Bebeji','Bichi','Bunkure','Dala','Dambatta','Dawakin Kudu','Dawakin Tofa','Doguwa','Fagge','Gabasawa','Garko','Garun Mallam','Gaya','Gezawa','Gwale','Gwarzo','Kabo','Kano Municipal','Karaye','Kibiya','Kiru','Kumbotso','Kunchi','Kura','Madobi','Makoda','Minjibir','Nasarawa','Rano','Rimin Gado','Rogo','Shanono','Sumaila','Takai','Tarauni','Tofa','Tsanyawa','Tudun Wada','Ungogo','Warawa','Wudil'],
  'Katsina': ['Bakori','Batagarawa','Batsari','Baure','Bindawa','Charanchi','Dan Musa','Dandume','Danja','Daura','Dutsi',"Dutsin-Ma",'Faskari','Funtua','Ingawa','Jibia','Kafur','Kaita','Kankara','Kankia','Katsina','Kurfi','Kusada',"Mai'Adua",'Malumfashi','Mani','Mashi','Matazu','Musawa','Rimi','Sabuwa','Safana','Sandamu','Zango'],
  'Kebbi': ['Aleiro','Arewa Dandi','Argungu','Augie','Bagudo','Birnin Kebbi','Bunza','Dandi','Fakai','Gwandu','Jega','Kalgo','Koko/Besse','Maiyama','Ngaski','Sakaba','Shanga','Suru','Wasagu/Danko','Yauri','Zuru'],
  'Kogi': ['Adavi','Ajaokuta','Ankpa','Bassa','Dekina','Ibaji','Idah','Igalamela Odolu','Ijumu','Kabba/Bunu','Kogi','Lokoja','Mopa Muro','Ofu','Ogori/Magongo','Okehi','Okene','Olamaboro','Omala','Yagba East','Yagba West'],
  'Kwara': ['Asa','Baruten','Edu','Ekiti','Ifelodun','Ilorin East','Ilorin South','Ilorin West','Irepodun','Isin','Kaiama','Moro','Offa','Oke Ero','Oyun','Pategi'],
  'Lagos': ['Agege','Ajeromi-Ifelodun','Alimosho','Amuwo-Odofin','Apapa','Badagry','Epe','Eti Osa','Ibeju-Lekki','Ifako-Ijaiye','Ikeja','Ikorodu','Kosofe','Lagos Island','Lagos Mainland','Mushin','Ojo','Oshodi-Isolo','Shomolu','Surulere'],
  'Nasarawa': ['Akwanga','Awe','Doma','Karu','Keana','Keffi','Kokona','Lafia','Nasarawa','Nasarawa Egon','Obi','Toto','Wamba'],
  'Niger': ['Agaie','Agwara','Bida','Borgu','Bosso','Chanchaga','Edati','Gbako','Gurara','Katcha','Kontagora','Lapai','Lavun','Magama','Mariga','Mashegu','Mokwa','Moya','Paikoro','Rafi','Rijau','Shiroro','Suleja','Tafa','Wushishi'],
  'Ogun': ['Abeokuta North','Abeokuta South','Ado-Odo/Ota','Egbado North','Egbado South','Ewekoro','Ifo','Ijebu East','Ijebu North','Ijebu North East','Ijebu Ode','Ikenne','Imeko Afon','Ipokia','Obafemi Owode','Odeda','Odogbolu','Ogun Waterside','Remo North','Shagamu'],
  'Ondo': ['Akoko North-East','Akoko North-West','Akoko South-West','Akoko South-East','Akure North','Akure South','Ese Odo','Idanre','Ifedore','Ilaje','Ile Oluji/Okeigbo','Irele','Odigbo','Okitipupa','Ondo East','Ondo West','Ose','Owo'],
  'Osun': ['Aiyedaade','Aiyedire','Atakunmosa East','Atakunmosa West','Boluwaduro','Boripe','Ede North','Ede South','Egbedore','Ejigbo','Ede North','Ifedayo','Ifelodun','Ila','Ilesa East','Ilesa West','Irepodun','Irewole','Isokan','Iwo','Obokun','Odo Otin','Ola Oluwa','Olorunda','Oriade','Orolu','Osogbo'],
  'Oyo': ['Afijio','Akinyele','Atiba','Atisbo','Egbeda','Ibadan North','Ibadan North-East','Ibadan North-West','Ibadan South-East','Ibadan South-West','Ibarapa Central','Ibarapa East','Ibarapa North','Ido','Irepo','Iseyin','Itesiwaju','Iwajowa','Kajola','Lagelu','Ogbomosho North','Ogbomosho South','Ogo Oluwa','Olorunsogo','Oluyole','Ona Ara','Orelope','Ori Ire','Oyo East','Oyo West','Saki East','Saki West','Surulere'],
  'Plateau': ['Barkin Ladi','Bassa','Bokkos','Jos East','Jos North','Jos South','Kanam','Kanke','Langtang North','Langtang South','Mangu','Mikang','Pankshin',"Qua'an Pan",'Riyom','Shendam','Wase'],
  'Rivers': ['Abua/Odual','Ahoada East','Ahoada West','Akuku-Toru','Andoni','Asari-Toru','Bonny','Degema','Emuoha','Eleme','Etche','Gokana','Ikwerre','Khana','Obio/Akpor','Ogba/Egbema/Ndoni','Ogu/Bolo','Okrika','Omuma','Opobo/Nkoro','Oyigbo','Port Harcourt','Tai'],
  'Sokoto': ['Binji','Bodinga','Dange Shuni','Gada','Goronyo','Gudu','Gwadabawa','Illela','Isa','Kebbe','Kware','Rabah','Sabon Birni','Shagari','Silame','Sokoto North','Sokoto South','Tambuwal','Tangaza','Tureta','Wamako','Wurno','Yabo'],
  'Taraba': ['Ardo Kola','Bali','Donga','Gashaka','Gassol','Ibi','Jalingo','Karim Lamido','Kurmi','Lau','Sardauna','Takum','Ussa','Wukari','Yorro','Zing'],
  'Yobe': ['Bade','Bursari','Damaturu','Fika','Fune','Geidam','Gujba','Gulani','Jakusko','Karasuwa','Machina','Nangere','Nguru','Potiskum','Tarmuwa','Yunusari','Yusufari'],
  'Zamfara': ['Anka','Bakura','Birnin Magaji/Kiyaw','Bukkuyum','Bungudu','Chafe','Gummi','Gusau','Kaura Namoda','Maradun','Maru','Shinkafi','Talata Mafara','Tsafe','Zurmi'],
};

export const nigeriaStateNames = Object.keys(nigeriaStates);

