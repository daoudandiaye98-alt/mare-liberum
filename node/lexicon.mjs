// Mare Liberum · briefs in every language.
// 1. Which language a request is in: by script first, then by common words (about 45 languages).
// 2. Which kind of work it is, whatever the language: core words of each kind in 17 languages.
// 3. Page labels in those languages. Brief content stays in plain English for agents; they answer in the request's language.

const SCRIPTS = [
  [/[֐-׿]/, 'he'], [/[؀-ۿ]/, 'ar'], [/[ऀ-ॿ]/, 'hi'], [/[ঀ-৿]/, 'bn'], [/[஀-௿]/, 'ta'],
  [/[ఀ-౿]/, 'te'], [/[฀-๿]/, 'th'], [/[Ⴀ-ჿ]/, 'ka'], [/[԰-֏]/, 'hy'], [/[ሀ-፿]/, 'am'],
  [/[가-힯ᄀ-ᇿ]/, 'ko'], [/[぀-ヿ]/, 'ja'], [/[一-鿿]/, 'zh'], [/[Ͱ-Ͽ]/, 'el'], [/[Ѐ-ӿ]/, 'ru'],
];
const STOP = {
  en: 'the a an to of in on is it i my me be are and for with this that you your what how please write make can from about',
  de: 'der die das und ich für mit ein eine nicht bitte mein meine unser wie was soll schreibe schreib erstelle mach als bei auf zum zur ist sind oder auch noch nach wir uns dem den des über mir mich',
  es: 'el la los las y para con una un por favor como qué que mi mis escribe haz crea sobre del este esta necesito quiero puedes',
  fr: 'le la les et pour avec une un pas mon ma mes comment quoi écris fais crée sur des du ce cette je veux peux besoin',
  pt: 'o a os as e para com uma um por favor como que meu minha escreva faça crie sobre do da este esta preciso quero você',
  it: 'il lo la gli le e per con una un per favore come che mio mia scrivi fai crea sul della questo questa voglio puoi bisogno',
  nl: 'de het een en voor met niet mijn hoe wat schrijf maak over van dit deze ik wil kun je nodig',
  pl: 'i w na dla z nie jak co mój moja napisz zrób stwórz o tego ten ta chcę możesz potrzebuję proszę',
  tr: 've bir için ile bu şu nasıl ne benim yaz yap oluştur hakkında istiyorum lütfen bana',
  id: 'dan yang untuk dengan ini itu bagaimana apa saya tolong buat tulis tentang dari ingin bisa',
  vi: 'và của cho với này một tôi làm viết giúp về được những không',
  sv: 'och för med en ett inte min hur vad skriv gör skapa om av den det jag vill kan',
  da: 'og for med en et ikke min hvordan hvad skriv lav om af den det jeg vil kan',
  no: 'og for med en et ikke min hvordan hva skriv lag om av den det jeg vil kan',
  fi: 'ja on että kanssa ei minun miten mitä kirjoita tee luo jostakin haluan voitko',
  cs: 'a pro s na je jak co můj moje napiš udělej vytvoř o tento tato chci můžeš',
  ro: 'și pentru cu un o nu cum ce meu mea scrie fă creează despre din acest această vreau poți',
  hu: 'és a az egy nem hogyan mit az én írj csinálj készíts erről ezt szeretném tudsz',
  sw: 'na kwa ya wa ni hii jinsi nini andika tengeneza kuhusu nataka tafadhali',
};
const STOPSETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(' '))]));
export const LANG_NAMES = { en: 'English', de: 'German', es: 'Spanish', fr: 'French', pt: 'Portuguese', it: 'Italian', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', id: 'Indonesian', vi: 'Vietnamese', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian', sw: 'Swahili', he: 'Hebrew', ar: 'Arabic', fa: 'Persian', ur: 'Urdu', hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', th: 'Thai', ka: 'Georgian', hy: 'Armenian', am: 'Amharic', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', el: 'Greek', ru: 'Russian', uk: 'Ukrainian', bg: 'Bulgarian', sr: 'Serbian' };
export const RTL = new Set(['ar', 'he', 'fa', 'ur']);

export const detectLang = (text) => langInfo(text).lang;
// the language and whether it is clear: a script decides at once; Latin text needs at least one common word (two for English, the fallback)
export function langInfo(text) {
  const lang = guessLang(text), t = String(text || '');
  if (SCRIPTS.some(([re]) => re.test(t))) return { lang, sure: true };
  const words = t.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean), hits = words.filter((w) => STOPSETS[lang]?.has(w)).length;
  return { lang, sure: lang === 'en' ? hits >= 2 : hits >= 1 || lang !== 'en' };
}
function guessLang(text) {
  const t = String(text || '');
  for (const [re, code] of SCRIPTS) if (re.test(t)) {
    if (code === 'ar') return /[پچژگ]/.test(t) ? 'fa' : /[ےںٹڈڑ]/.test(t) ? 'ur' : 'ar';
    if (code === 'ru') return /[ґєії]/i.test(t) ? 'uk' : /[ђћџљњ]/i.test(t) ? 'sr' : /\b(и|на)\b/.test(t) && /ъ/.test(t) && !/ы/.test(t) ? 'bg' : 'ru';
    if (code === 'zh' && /[぀-ヿ]/.test(t)) return 'ja';
    return code;
  }
  const words = t.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (!words.length) return 'en';
  let best = 'en', score = 0;
  for (const [code, set] of Object.entries(STOPSETS)) { const s = words.filter((w) => set.has(w)).length; if (s > score) { best = code; score = s; } }
  if (score === 0) { if (/[äöüß]/i.test(t)) return 'de'; if (/[ñ¿¡]/.test(t)) return 'es'; if (/[ãõ]/.test(t)) return 'pt'; if (/[ąęłńśźż]/.test(t)) return 'pl'; if (/[ğışİ]/.test(t)) return 'tr'; if (/[ơưđ]/i.test(t)) return 'vi'; if (/[çéèêàù]/.test(t)) return 'fr'; }
  return best;
}

// kind ← core words in many languages (es fr pt it nl pl tr ru ar hi zh ja ko id vi sv, plus a few more where common)
export const LEX_LANGS = ['es', 'fr', 'pt', 'it', 'nl', 'pl', 'tr', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'id', 'vi', 'sv'];
const L = `
cold-email|correo en frío,correo de ventas,captar clientes|email de prospection,prospection,démarchage|email de prospecção,prospecção,captar clientes|email a freddo,prospezione|acquisitiemail,koude acquisitie|cold mailing,pozyskiwanie klientów|soğuk e-posta,müşteri kazanma|холодное письмо,холодная рассылка,привлечение клиентов|بريد بارد,رسالة تسويقية|कोल्ड ईमेल,ग्राहक खोज|开发信,冷邮件,获客邮件|営業メール,コールドメール|콜드 메일,영업 메일|email penawaran,cold email|email chào hàng|kalla mejl,säljmejl
email-reply|correo,email,responder|courriel,e-mail,répondre|e-mail,email,responder|email,mail,rispondere|e-mail,mail,beantwoord|e-mail,mail,odpowiedz|e-posta,mail,cevap|письмо,электронное письмо,ответь на|بريد إلكتروني,رسالة,رد على|ईमेल,पत्र,जवाब|邮件,电子邮件,回复|メール,返信|이메일,메일,답장|email,surel,balas|email,thư,trả lời|mejl,e-post,svara
newsletter|boletín|lettre d'information,infolettre|boletim informativo|newsletter|nieuwsbrief|newsletter,biuletyn|bülten|рассылка,информационный бюллетень|نشرة إخبارية|न्यूज़लेटर|新闻通讯,电子报|ニュースレター,メルマガ|뉴스레터|buletin|bản tin|nyhetsbrev
blog-post|artículo,entrada de blog,blog|article,billet de blog,blog|artigo,post de blog,blog|articolo,post del blog|artikel,blogpost|artykuł,wpis na blogu|makale,blog yazısı|статья,пост в блог|مقال,تدوينة|लेख,ब्लॉग|文章,博客|記事,ブログ|기사,블로그 글|artikel,tulisan blog|bài viết,bài blog|artikel,blogginlägg
social-post|publicación,post para instagram,post para linkedin|publication,post linkedin,post instagram|publicação,post para instagram|post per instagram,post linkedin|social media post|post na linkedin,wpis w mediach|gönderi,paylaşım|пост для соцсетей,пост в инстаграм|منشور,تغريدة|सोशल मीडिया पोस्ट|朋友圈文案,社交媒体帖子,小红书|SNS投稿,ツイート|SNS 게시물,인스타 게시물|postingan,caption|bài đăng mạng xã hội|inlägg
product-description|descripción de producto|description de produit,fiche produit|descrição de produto|descrizione prodotto|productbeschrijving|opis produktu|ürün açıklaması|описание товара|وصف المنتج|उत्पाद विवरण|产品描述,商品描述|商品説明|상품 설명|deskripsi produk|mô tả sản phẩm|produktbeskrivning
landing-page|página de aterrizaje,landing page,texto para la web|page d'atterrissage,texte du site|página de destino,texto do site|pagina di destinazione,testi del sito|landingspagina,websitetekst|strona docelowa,tekst na stronę|açılış sayfası,web sitesi metni|лендинг,текст для сайта|صفحة هبوط,نص الموقع|लैंडिंग पेज,वेबसाइट टेक्स्ट|落地页,网站文案|ランディングページ,ウェブサイトの文章|랜딩 페이지,웹사이트 문구|halaman arahan,teks situs|trang đích,nội dung website|landningssida,webbtext
press-release|nota de prensa,comunicado de prensa|communiqué de presse|comunicado de imprensa,press release|comunicato stampa|persbericht|komunikat prasowy|basın bülteni|пресс-релиз|بيان صحفي|प्रेस विज्ञप्ति|新闻稿|プレスリリース|보도자료|siaran pers|thông cáo báo chí|pressmeddelande
summary|resumen,resume|résumé,résumer,synthèse|resumo,resumir|riassunto,riassumi|samenvatting,vat samen|streszczenie,podsumowanie|özet,özetle|краткое содержание,резюме,кратко|ملخص,لخص|सारांश,संक्षेप|总结,摘要,概括|要約,まとめ|요약,정리|ringkasan,rangkum|tóm tắt|sammanfattning,sammanfatta
meeting-notes|acta,notas de reunión|compte rendu,procès-verbal|ata,notas da reunião|verbale,appunti della riunione|notulen|protokół,notatki ze spotkania|toplantı notları,tutanak|протокол встречи,протокол совещания|محضر اجتماع|बैठक के नोट्स|会议纪要,会议记录|議事録|회의록|notulen rapat|biên bản họp|mötesanteckningar,protokoll
report|informe|rapport|relatório|rapporto,relazione|rapport,verslag|raport,sprawozdanie|rapor|отчёт,отчет,доклад|تقرير|रिपोर्ट|报告|レポート,報告書|보고서|laporan|báo cáo|rapport
research|investiga,investigación|recherche,recherche sur|pesquisa,pesquise|ricerca,ricerca su|onderzoek,zoek uit|zbadaj,badanie|araştır,araştırma|исследование,найди информацию,изучи|بحث,ابحث عن|शोध,अनुसंधान|调研,研究,查一下|調べて,リサーチ,調査|조사,리서치|riset,penelitian,cari tahu|nghiên cứu,tìm hiểu|undersök,research
market-research|estudio de mercado,análisis de la competencia|étude de marché,analyse concurrentielle|pesquisa de mercado,concorrência|ricerca di mercato,analisi della concorrenza|marktonderzoek,concurrentieanalyse|badanie rynku,analiza konkurencji|pazar araştırması,rakip analizi|анализ рынка,анализ конкурентов|دراسة السوق,تحليل المنافسين|बाजार अनुसंधान,प्रतियोगी विश्लेषण|市场调研,竞品分析|市場調査,競合分析|시장 조사,경쟁사 분석|riset pasar,analisis pesaing|nghiên cứu thị trường,phân tích đối thủ|marknadsundersökning,konkurrentanalys
fact-check|verificar,es verdad|vérifier,est-ce vrai|verificar,é verdade|verificare,è vero|klopt het,factcheck|czy to prawda,sprawdź fakty|doğru mu,doğrula|это правда,проверь факт|هل صحيح,تحقق|क्या यह सच है,तथ्य जांच|是真的吗,核实|本当,ファクトチェック|사실 확인,진짜야|apakah benar,cek fakta|có thật không,kiểm chứng|stämmer det,faktakoll
data-analysis|análisis de datos,analiza los datos|analyse de données|análise de dados|analisi dei dati|data-analyse,analyseer de data|analiza danych|veri analizi|анализ данных|تحليل البيانات|डेटा विश्लेषण|数据分析|データ分析|데이터 분석|analisis data|phân tích dữ liệu|dataanalys
spreadsheet|hoja de cálculo,presupuesto,excel|tableur,budget,excel|planilha,orçamento,excel|foglio di calcolo,budget,excel|spreadsheet,begroting,excel|arkusz kalkulacyjny,budżet,excel|tablo,bütçe,excel|таблица,бюджет,эксель|جدول بيانات,ميزانية|स्प्रेडशीट,बजट|表格,预算,电子表格|スプレッドシート,予算,エクセル|스프레드시트,예산,엑셀|spreadsheet,anggaran|bảng tính,ngân sách|kalkylark,budget
presentation|presentación,diapositivas|présentation,diapositives|apresentação,slides|presentazione,diapositive|presentatie,dia's|prezentacja,slajdy|sunum,slayt|презентация,слайды|عرض تقديمي,شرائح|प्रस्तुति,स्लाइड|演示文稿,幻灯片,PPT|プレゼン,スライド|프레젠테이션,발표 자료|presentasi,slide|bài thuyết trình,slide|presentation,bildspel
code-feature|programa,código,crea una app|code,programme,crée une application|código,programa,crie um app|codice,programma|code,programmeer|kod,program,napisz aplikację|kod,program yaz,uygulama|код,программа,напиши скрипт|برمجة,كود,تطبيق|कोड,प्रोग्राम|写代码,编程,程序|コード,プログラム,アプリを作って|코드,프로그램,앱 만들어|kode,program,buat aplikasi|viết code,lập trình|kod,program
bug-fix|error,no funciona,arregla|erreur,bug,ne marche pas|erro,não funciona,conserte|errore,non funziona|fout,werkt niet|błąd,nie działa,napraw|hata,çalışmıyor,düzelt|ошибка,не работает,исправь|خطأ,لا يعمل|त्रुटि,काम नहीं कर रहा|报错,错误,修复|エラー,バグ,動かない|오류,버그,안 돼|error,tidak berfungsi|lỗi,không chạy|fel,fungerar inte
sql|consulta sql,base de datos|requête sql,base de données|consulta sql,banco de dados|query sql,database|sql-query,database|zapytanie sql,baza danych|sql sorgusu,veritabanı|sql запрос,база данных|استعلام sql,قاعدة بيانات|एसक्यूएल,डेटाबेस|SQL查询,数据库|SQLクエリ,データベース|SQL 쿼리,데이터베이스|kueri sql,basis data|truy vấn sql,cơ sở dữ liệu|sql-fråga,databas
automation|automatiza,automatización|automatiser,automatisation|automatizar,automação|automatizzare,automazione|automatiseren|automatyzacja,zautomatyzuj|otomatikleştir,otomasyon|автоматизация,автоматизировать|أتمتة|स्वचालन,ऑटोमेशन|自动化|自動化|자동화|otomatisasi|tự động hóa|automatisera
translation|traduce,traducción|traduis,traduction|traduza,tradução|traduci,traduzione|vertaal,vertaling|przetłumacz,tłumaczenie|çevir,çeviri|переведи,перевод|ترجم,ترجمة|अनुवाद|翻译|翻訳|번역|terjemahkan,terjemahan|dịch|översätt,översättning
editing|corrige,revisa el texto,mejora|corrige,relis,améliore|corrija,revise,melhore|correggi,rivedi|corrigeer,verbeter|popraw,korekta|düzelt,redaksiyon|исправь,отредактируй,улучши текст|صحح,حرر|सुधारें,संपादित करें|润色,修改,校对|添削,校正|교정,다듬어|perbaiki,sunting|sửa,chỉnh sửa|korrekturläs,förbättra
cv|currículum,cv|cv,curriculum vitae|currículo,cv|curriculum,cv|cv,curriculum vitae|cv,życiorys|özgeçmiş,cv|резюме для работы,cv|سيرة ذاتية|बायोडाटा,रिज्यूमे|简历|履歴書,職務経歴書|이력서|cv,riwayat hidup|sơ yếu lý lịch,cv|cv,meritförteckning
cover-letter|carta de presentación|lettre de motivation|carta de apresentação|lettera di presentazione|motivatiebrief,sollicitatiebrief|list motywacyjny|ön yazı,motivasyon mektubu|сопроводительное письмо|خطاب تقديم|कवर लेटर|求职信|カバーレター,志望動機|자기소개서,커버레터|surat lamaran|thư xin việc|personligt brev
trip-plan|viaje,itinerario|voyage,itinéraire|viagem,roteiro|viaggio,itinerario|reis,reisplan|podróż,plan podróży|seyahat,gezi planı|путешествие,маршрут поездки|رحلة,خطة سفر|यात्रा,यात्रा योजना|旅行,行程|旅行,旅程|여행,여행 일정|perjalanan,itinerari|du lịch,lịch trình|resa,resplan
travel-booking|vuelo,hotel,reserva|vol,hôtel,réserver|voo,hotel,reservar|volo,albergo,prenota|vlucht,hotel,boeken|lot,hotel,rezerwacja|uçuş,otel,rezervasyon|авиабилет,отель,забронировать|رحلة طيران,فندق,حجز|उड़ान,होटल,बुकिंग|机票,酒店,预订|航空券,ホテル,予約|항공권,호텔,예약|tiket pesawat,hotel,pesan|vé máy bay,khách sạn,đặt|flyg,hotell,boka
shopping|comprar,compra|acheter,achat|comprar,compra|comprare,acquisto|kopen|kupić,zakup|satın al|купить,покупка|شراء|खरीदना|购买,买|買いたい,購入|구매,사고 싶|beli,membeli|mua|köpa
event-plan|evento,fiesta,boda|événement,fête,mariage|evento,festa,casamento|evento,festa,matrimonio|evenement,feest,bruiloft|wydarzenie,impreza,ślub|etkinlik,parti,düğün|мероприятие,праздник,свадьба|حدث,حفلة,زفاف|कार्यक्रम,पार्टी,शादी|活动,派对,婚礼|イベント,パーティー,結婚式|행사,파티,결혼식|acara,pesta,pernikahan|sự kiện,tiệc,đám cưới|evenemang,fest,bröllop
project-plan|plan de proyecto,estrategia|plan de projet,stratégie|plano de projeto,estratégia|piano di progetto,strategia|projectplan,strategie|plan projektu,strategia|proje planı,strateji|план проекта,стратегия|خطة مشروع,استراتيجية|परियोजना योजना,रणनीति|项目计划,战略|プロジェクト計画,戦略|프로젝트 계획,전략|rencana proyek,strategi|kế hoạch dự án,chiến lược|projektplan,strategi
decision|debería,decidir,pros y contras|devrais-je,décider,avantages et inconvénients|devo,decidir,prós e contras|dovrei,decidere,pro e contro|moet ik,beslissen,voor- en nadelen|czy powinienem,decyzja,za i przeciw|yapmalı mıyım,karar,artı eksi|стоит ли,решить,плюсы и минусы|هل يجب,قرار,إيجابيات وسلبيات|क्या मुझे,निर्णय,फायदे नुकसान|该不该,决定,利弊|べきか,決める,メリットデメリット|해야 할까,결정,장단점|haruskah,keputusan,plus minus|có nên,quyết định,ưu nhược điểm|borde jag,beslut,för- och nackdelar
explain|explica,qué es,cómo funciona|explique,qu'est-ce que,comment fonctionne|explique,o que é,como funciona|spiega,cos'è,come funziona|leg uit,wat is,hoe werkt|wyjaśnij,co to jest,jak działa|açıkla,nedir,nasıl çalışır|объясни,что такое,как работает|اشرح,ما هو,كيف يعمل|समझाइए,क्या है,कैसे काम करता है|解释,是什么,怎么工作|説明して,とは,仕組み|설명해,무엇인가,어떻게 작동|jelaskan,apa itu,bagaimana cara kerja|giải thích,là gì,hoạt động như thế nào|förklara,vad är,hur fungerar
study-plan|plan de estudio,examen|plan d'étude,examen|plano de estudos,exame,prova|piano di studio,esame|studieplan,examen|plan nauki,egzamin|çalışma planı,sınav|план подготовки,экзамен|خطة دراسة,امتحان|अध्ययन योजना,परीक्षा|学习计划,考试|勉強計画,試験|공부 계획,시험|rencana belajar,ujian|kế hoạch học,kỳ thi|studieplan,tenta
recipe|receta,menú semanal|recette,menu de la semaine|receita,cardápio|ricetta,menù|recept,weekmenu|przepis,jadłospis|tarif,yemek planı|рецепт,меню на неделю|وصفة,خطة وجبات|रेसिपी,भोजन योजना|菜谱,食谱|レシピ,献立|레시피,식단|resep,menu mingguan|công thức nấu ăn,thực đơn|recept,veckomeny
image-prompt|imagen,ilustración,logo|image,illustration,logo|imagem,ilustração,logotipo|immagine,illustrazione,logo|afbeelding,illustratie,logo|obraz,ilustracja,logo|görsel,illüstrasyon,logo|изображение,картинка,логотип|صورة,رسم توضيحي,شعار|छवि,चित्र,लोगो|图片,插画,画图,logo|画像,イラスト,ロゴ|이미지,일러스트,로고|gambar,ilustrasi,logo|hình ảnh,minh họa,logo|bild,illustration,logotyp
video-prompt|video con ia,genera un video|vidéo ia,génère une vidéo|vídeo com ia,gere um vídeo|video con ia,genera un video|ai-video|wideo ai|yapay zeka video|видео ии,сгенерируй видео|فيديو بالذكاء الاصطناعي|एआई वीडियो|AI视频,生成视频|AI動画,動画生成|AI 영상,영상 생성|video ai|video ai|ai-video
video-script|guion,guion de video,youtube|script vidéo,scénario|roteiro,roteiro de vídeo|sceneggiatura,script video|videoscript,script|scenariusz,skrypt wideo|senaryo,video metni|сценарий,сценарий видео|سيناريو,نص فيديو|स्क्रिप्ट,वीडियो स्क्रिप्ट|脚本,视频脚本|台本,動画の台本|대본,영상 스크립트|naskah video|kịch bản video|manus,videomanus
music-prompt|canción,música con ia|chanson,musique ia|música,canção com ia|canzone,musica ia|nummer,ai-muziek|piosenka,muzyka ai|şarkı,yapay zeka müzik|песня,музыка ии|أغنية,موسيقى|गीत,एआई संगीत|歌曲,AI音乐|曲,AI音楽|노래,AI 음악|lagu,musik ai|bài hát,nhạc ai|låt,ai-musik
seo|posicionamiento,seo|référencement,seo|seo,posicionamento|seo,posizionamento|seo,vindbaarheid|seo,pozycjonowanie|seo,arama motoru|сео,продвижение сайта|تحسين محركات البحث,سيو|एसईओ|SEO,搜索引擎优化|SEO,検索順位|SEO,검색 최적화|seo|seo|seo,sökmotoroptimering
documentation|documentación,manual|documentation,mode d'emploi|documentação,manual|documentazione,manuale|documentatie,handleiding|dokumentacja,instrukcja|dokümantasyon,kılavuz|документация,инструкция|توثيق,دليل|दस्तावेज़ीकरण,मैनुअल|文档,说明书|ドキュメント,マニュアル|문서,매뉴얼|dokumentasi,panduan|tài liệu,hướng dẫn sử dụng|dokumentation,manual
legal-text|contrato,términos,aviso legal|contrat,conditions générales,mentions légales|contrato,termos|contratto,termini|contract,voorwaarden|umowa,regulamin|sözleşme,şartlar|договор,условия,юридический|عقد,شروط|अनुबंध,शर्तें|合同,条款|契約書,利用規約|계약서,약관|kontrak,syarat|hợp đồng,điều khoản|avtal,villkor
support-reply|atención al cliente,queja,reclamación|service client,réclamation|atendimento ao cliente,reclamação|assistenza clienti,reclamo|klantenservice,klacht|obsługa klienta,reklamacja|müşteri hizmetleri,şikayet|поддержка клиентов,жалоба|خدمة العملاء,شكوى|ग्राहक सेवा,शिकायत|客服,投诉|カスタマーサポート,クレーム|고객 지원,불만|layanan pelanggan,keluhan|chăm sóc khách hàng,khiếu nại|kundtjänst,klagomål
naming|nombre para,eslogan,ideas para|nom pour,slogan,idées pour|nome para,slogan,ideias para|nome per,slogan,idee per|naam voor,slogan,ideeën voor|nazwa dla,hasło,pomysły na|isim önerisi,slogan,fikir|название для,слоган,идеи для|اسم ل,شعار,أفكار ل|नाम,स्लोगन,विचार|起名,口号,点子|名前,キャッチコピー,アイデア|이름,슬로건,아이디어|nama untuk,slogan,ide|tên cho,khẩu hiệu,ý tưởng|namn på,slogan,idéer
prompt|prompt,instrucciones para|prompt,instructions pour|prompt,instruções para|prompt,istruzioni per|prompt,instructies voor|prompt,instrukcje dla|prompt,talimat|промпт,инструкция для|موجه,تعليمات|प्रॉम्प्ट|提示词|プロンプト|프롬프트|prompt|câu lệnh prompt|prompt
job-search|buscar trabajo,empleo|chercher un emploi,offres d'emploi|procurar emprego,vagas|cercare lavoro,offerte di lavoro|vacatures,baan zoeken|szukam pracy,oferty pracy|iş arıyorum,iş ilanları|ищу работу,вакансии|وظائف,البحث عن عمل|नौकरी खोज|找工作,招聘|求人,仕事探し|구직,채용 공고|lowongan kerja,cari kerja|tìm việc|lediga jobb,söka jobb
health-info|síntomas,salud,medicamento|symptômes,santé,médicament|sintomas,saúde,remédio|sintomi,salute,farmaco|symptomen,gezondheid,medicijn|objawy,zdrowie,lek|belirtiler,sağlık,ilaç|симптомы,здоровье,лекарство|أعراض,صحة,دواء|लक्षण,स्वास्थ्य,दवा|症状,健康,药|症状,健康,薬|증상,건강,약|gejala,kesehatan,obat|triệu chứng,sức khỏe,thuốc|symtom,hälsa,läkemedel
finance-info|impuestos,invertir,hipoteca|impôts,investir,prêt immobilier|impostos,investir,financiamento|tasse,investire,mutuo|belasting,beleggen,hypotheek|podatki,inwestować,kredyt hipoteczny|vergi,yatırım,kredi|налоги,инвестировать,ипотека|ضرائب,استثمار,رهن|कर,निवेश,ऋण|税,投资,房贷|税金,投資,住宅ローン|세금,투자,대출|pajak,investasi,kpr|thuế,đầu tư,vay|skatt,investera,bolån
easy-language|lenguaje fácil,lectura fácil|facile à lire,langage simple|linguagem simples|linguaggio facile|eenvoudige taal|tekst łatwy do czytania|kolay dil|простой язык,легкий язык|لغة مبسطة|सरल भाषा|简明语言|やさしい日本語|쉬운 말|bahasa sederhana|ngôn ngữ đơn giản|lättläst
tutoring|deberes,tarea,clases particulares|devoirs,soutien scolaire|lição de casa,dever de casa|compiti,ripetizioni|huiswerk,bijles|zadanie domowe,korepetycje|ödev,özel ders|домашнее задание,репетитор|واجب منزلي,درس خصوصي|गृहकार्य,ट्यूशन|作业,辅导|宿題,家庭教師|숙제,과외|pekerjaan rumah,les privat|bài tập về nhà,gia sư|läxa,läxhjälp
proposal|presupuesto para cliente,propuesta comercial|devis,proposition commerciale|orçamento,proposta comercial|preventivo,proposta commerciale|offerte|oferta,wycena|teklif,fiyat teklifi|коммерческое предложение,смета|عرض سعر,عرض تجاري|प्रस्ताव,कोटेशन|报价,方案书|見積もり,提案書|견적서,제안서|penawaran harga,proposal|báo giá,đề xuất|offert
grant|subvención,solicitud de financiación|subvention,demande de financement|subsídio,edital|bando,finanziamento|subsidie,subsidieaanvraag|grant,wniosek o dofinansowanie|hibe,fon başvurusu|грант,заявка на финансирование|منحة,طلب تمويل|अनुदान|资助申请,基金申请|助成金,補助金申請|지원금,보조금 신청|hibah,proposal pendanaan|tài trợ,xin tài trợ|bidrag,ansökan om finansiering
interview-prep|entrevista de trabajo|entretien d'embauche|entrevista de emprego|colloquio di lavoro|sollicitatiegesprek|rozmowa kwalifikacyjna|iş görüşmesi|собеседование|مقابلة عمل|साक्षात्कार|面试|面接|면접|wawancara kerja|phỏng vấn|anställningsintervju
negotiation|negociar,aumento de sueldo|négocier,augmentation de salaire|negociar,aumento salarial|negoziare,aumento di stipendio|onderhandelen,loonsverhoging|negocjować,podwyżka|pazarlık,zam istemek|переговоры,повышение зарплаты|تفاوض,زيادة راتب|मोलभाव,वेतन वृद्धि|谈判,加薪|交渉,昇給|협상,연봉 인상|negosiasi,kenaikan gaji|đàm phán,tăng lương|förhandla,löneförhöjning
content-calendar|calendario de contenidos|calendrier éditorial|calendário de conteúdo|calendario editoriale|contentkalender|kalendarz treści|içerik takvimi|контент-план|تقويم المحتوى|कंटेंट कैलेंडर|内容日历,内容排期|コンテンツカレンダー|콘텐츠 캘린더|kalender konten|lịch nội dung|innehållskalender
agenda|orden del día,agenda|ordre du jour|pauta,agenda|ordine del giorno|agenda|porządek obrad,agenda|gündem|повестка дня|جدول أعمال|एजेंडा|议程|議題,アジェンダ|안건|agenda rapat|chương trình họp|dagordning
`.trim().split('\n').map((line) => { const [kind, ...cells] = line.split('|'); return [kind, cells.map((c, i) => ({ lang: LEX_LANGS[i], words: c.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean) }))]; });
export const LEXICON = L;
const CJK = /[぀-ヿ一-鿿가-힯฀-๿]/;
// kinds named in a request in any of these languages, with a weight
export function kindsByLexicon(text) {
  const t = String(text || '').toLowerCase(), out = {};
  for (const [kind, cells] of L) for (const w of new Set(cells.flatMap((c) => c.words))) {
    if (w.length < 2) continue;
    const hit = CJK.test(w) ? t.includes(w) : new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(t);
    if (hit) out[kind] = (out[kind] || 0) + 1.5 + Math.min(w.length, 20) / 10;
  }
  return out;
}
// the frequent ways of asking, in every language of the lexicon (for the phrasing pages)
// a slug that keeps every script readable: Latin letters lose their accents, other scripts stay as they are (percent-encoded in the URL)
export const slugOf = (p) => String(p).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
export function lexiconPhrases() {
  const seen = new Set(), out = [];
  for (const [kind, cells] of L) for (const { lang, words } of cells) for (const w of words) {
    const long = CJK.test(w) ? w.length >= 2 : /[a-zà-ÿ\u0100-\u024f\u0400-\u04ff]/.test(w) ? w.length >= 6 : w.length >= 3;
    const slug = slugOf(w), id = `${kind}/${lang}/${slug}`;
    if (!long || !slug || seen.has(id)) continue; seen.add(id); out.push({ kind, lang, phrase: w, slug });
  }
  return out;
}

// labels of the brief page in the language of the request
export const LABELS = {
  en: ['What the request left out', 'Worth asking', 'Method', 'Quality bar', 'Avoid', 'Deliver', 'Check before handing over', 'Done means', 'The full prompt', 'The strongest published results', 'assume'],
  de: ['Was die Anfrage weggelassen hat', 'Lohnt sich zu fragen', 'Methode', 'Qualitätslatte', 'Vermeiden', 'Liefern', 'Vor der Abgabe prüfen', 'Fertig heißt', 'Der vollständige Prompt', 'Die stärksten veröffentlichten Ergebnisse', 'annehmen'],
  es: ['Lo que la petición omitió', 'Vale la pena preguntar', 'Método', 'Nivel de calidad', 'Evitar', 'Entregar', 'Comprobar antes de entregar', 'Terminado significa', 'El prompt completo', 'Los mejores resultados publicados', 'suponer'],
  fr: ['Ce que la demande a omis', 'À demander', 'Méthode', 'Niveau de qualité', 'À éviter', 'Livrer', 'Vérifier avant de livrer', 'Terminé signifie', 'Le prompt complet', 'Les meilleurs résultats publiés', 'supposer'],
  pt: ['O que o pedido deixou de fora', 'Vale a pena perguntar', 'Método', 'Padrão de qualidade', 'Evitar', 'Entregar', 'Verificar antes de entregar', 'Pronto significa', 'O prompt completo', 'Os melhores resultados publicados', 'supor'],
  it: ['Cosa ha omesso la richiesta', 'Vale la pena chiedere', 'Metodo', 'Livello di qualità', 'Da evitare', 'Consegnare', 'Controllare prima di consegnare', 'Finito significa', 'Il prompt completo', 'I migliori risultati pubblicati', 'supporre'],
  nl: ['Wat het verzoek wegliet', 'Het vragen waard', 'Methode', 'Kwaliteitslat', 'Vermijden', 'Opleveren', 'Controleren voor oplevering', 'Klaar betekent', 'De volledige prompt', 'De sterkste gepubliceerde resultaten', 'aannemen'],
  pl: ['Czego zabrakło w prośbie', 'Warto zapytać', 'Metoda', 'Poprzeczka jakości', 'Unikać', 'Dostarczyć', 'Sprawdzić przed oddaniem', 'Gotowe znaczy', 'Pełny prompt', 'Najlepsze opublikowane wyniki', 'przyjąć'],
  tr: ['İstekte eksik olanlar', 'Sormaya değer', 'Yöntem', 'Kalite çıtası', 'Kaçının', 'Teslim', 'Teslimden önce kontrol', 'Bitti demek', 'Tam istem (prompt)', 'Yayınlanan en güçlü sonuçlar', 'varsay'],
  ru: ['Что упущено в запросе', 'Стоит спросить', 'Метод', 'Планка качества', 'Избегать', 'Результат', 'Проверить перед сдачей', 'Готово — это', 'Полный промпт', 'Лучшие опубликованные результаты', 'предположить'],
  uk: ['Що пропущено в запиті', 'Варто запитати', 'Метод', 'Планка якості', 'Уникати', 'Результат', 'Перевірити перед здачею', 'Готово — це', 'Повний промпт', 'Найкращі опубліковані результати', 'припустити'],
  ar: ['ما أغفله الطلب', 'يستحق السؤال', 'الطريقة', 'معيار الجودة', 'تجنب', 'التسليم', 'تحقق قبل التسليم', 'الإنجاز يعني', 'الموجّه الكامل', 'أقوى النتائج المنشورة', 'افترض'],
  hi: ['अनुरोध में क्या छूट गया', 'पूछने लायक', 'तरीका', 'गुणवत्ता का स्तर', 'इनसे बचें', 'क्या देना है', 'देने से पहले जांचें', 'पूरा होने का मतलब', 'पूरा प्रॉम्प्ट', 'सबसे अच्छे प्रकाशित परिणाम', 'मान लें'],
  zh: ['请求中遗漏的内容', '值得问的问题', '方法', '质量标准', '避免', '交付', '交付前检查', '完成的标准', '完整提示词', '已发布的最佳成果', '默认'],
  ja: ['依頼に欠けていたこと', '聞く価値のある質問', '方法', '品質の基準', '避けること', '納品物', '納品前の確認', '完了の条件', '完全なプロンプト', '公開された最良の成果', '仮定'],
  ko: ['요청에서 빠진 것', '물어볼 만한 것', '방법', '품질 기준', '피할 것', '결과물', '전달 전 확인', '완료의 기준', '전체 프롬프트', '가장 좋은 공개 결과', '가정'],
  id: ['Yang terlewat dari permintaan', 'Layak ditanyakan', 'Metode', 'Standar kualitas', 'Hindari', 'Serahkan', 'Periksa sebelum diserahkan', 'Selesai berarti', 'Prompt lengkap', 'Hasil terbaik yang diterbitkan', 'anggap'],
  vi: ['Những gì yêu cầu còn thiếu', 'Đáng hỏi', 'Phương pháp', 'Tiêu chuẩn chất lượng', 'Tránh', 'Bàn giao', 'Kiểm tra trước khi bàn giao', 'Hoàn thành nghĩa là', 'Prompt đầy đủ', 'Kết quả tốt nhất đã công bố', 'giả định'],
  sv: ['Vad förfrågan utelämnade', 'Värt att fråga', 'Metod', 'Kvalitetsribba', 'Undvik', 'Leverera', 'Kontrollera före leverans', 'Klart betyder', 'Hela prompten', 'De starkaste publicerade resultaten', 'anta'],
};
export const labelsFor = (lang) => LABELS[lang] || LABELS.en;
