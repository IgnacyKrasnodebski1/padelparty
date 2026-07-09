# Feature Specification: Ekosystem klubów i rezerwacji (Club Ecosystem)

**Feature Branch**: `001-club-ecosystem`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "budujemy pełną apkę do skalowania na świat — dodać kluby żeby zarabiać z rezerwacji, zrobić wielki ekosystem, w którym gdy klub wchodzi to gracze są tak zaangażowani że nie chcą wychodzić; coś charakterystycznego dla marketingu, co jednemu klubowi da mega zaangażowanie graczy; a im więcej klubów tym bardziej użytkownicy nie chcą wychodzić — sprzedajemy produkt, ale też wszystko dookoła"

## Vision (WHY) *(kontekst)*

PadelParty startuje jako apka do zapisywania gierek i rankingów dla ekipy znajomych. Ta funkcja przekształca ją w **dwustronny ekosystem padla** łączący **graczy** i **kluby**. Kluby zyskują gotowy silnik zaangażowania (ligi, rankingi na żywo, rezerwacje), a gracze — jedno miejsce, w którym żyje cały ich padel: statystyki, znajomi, ranking, rezerwacje i turnieje. Monetyzacja idzie z rezerwacji kortów oraz „wszystkiego dookoła" (abonamenty klubów, promowane wydarzenia, dodatki). Efekt docelowy: **efekt sieciowy i lock-in** — im więcej klubów i graczy, tym większa wartość bycia w środku i tym trudniej wyjść.

## Clarifications

### Session 2026-07-09

- Q: Czy MVP musi mieć płatności online od pierwszego dnia? → A: Tak — pełny przepływ płatności online (gracz płaci w apce, platforma potrąca prowizję, wypłaty do klubu) wchodzi w zakres MVP od dnia 1.
- Q: Jak silne ma być konto menedżera klubu? → A: Wzmocnione konto (e-mail + silne hasło) z **obowiązkowym 2FA od startu**; konta graczy bez zmian funkcjonalnych.
- Q (terminologia): → A: W całym produkcie słowo „ksywa" zastępujemy słowem **„login"** (UI, komunikaty, dokumentacja).
- Q: Jak klub wchodzi na platformę (onboarding)? → A: **Zawsze kuratorowane** — kluby wyłącznie na zaproszenie/po weryfikacji przez platformę, również przy skali; brak otwartej samoobsługowej rejestracji klubów. Po zaproszeniu menedżer sam konfiguruje korty i cennik.
- Q: Jaki cykl sezonu ligi klubu? → A: Klub może tworzyć **wiele lig/sezonów równolegle o różnych cyklach** (tygodniowe, miesięczne, roczne — działające w tym samym czasie); wynik gierki w klubie zasila wszystkie aktywne ligi tego klubu, w których uczestniczy gracz.
- Q: Kiedy gierka „liczy się do klubu"? → A: **Fizyczna karta klubu** wręczana graczowi przy pierwszej wizycie (unikalny kod do zeskanowania). Zeskanowanie karty dołącza gracza do klubu i jego lig, a skan przy zapisie gierki przypisuje ją do klubu; rezerwacja przez aplikację przypisuje klub automatycznie. Karta jest jednocześnie brandowanym artefaktem marketingowym MVP („myk").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Klub sprzedaje rezerwacje kortów (Priority: P1)

Menedżer klubu zakłada profil klubu, dodaje korty, godziny otwarcia i cennik. Gracze widzą wolne terminy, rezerwują i płacą w aplikacji, a klub otrzymuje potwierdzenie i wypłatę pomniejszoną o prowizję platformy. To silnik przychodowy całego ekosystemu.

**Why this priority**: Bez rezerwacji nie ma monetyzacji ani powodu, by kluby weszły. To fundament, na którym stoi reszta ekosystemu.

**Independent Test**: Utwórz klub z 1 kortem i cennikiem → gracz rezerwuje i opłaca slot → klub widzi rezerwację, platforma nalicza prowizję. Działa jako samodzielne MVP marketplace'u rezerwacji.

**Acceptance Scenarios**:

1. **Given** klub z opublikowanym kortem i wolnym slotem, **When** gracz wybiera slot i opłaca go, **Then** rezerwacja jest potwierdzona dla gracza i klubu, a należność (minus prowizja) trafia do rozliczenia klubu.
2. **Given** slot został właśnie zarezerwowany przez innego gracza, **When** drugi gracz próbuje go opłacić, **Then** system blokuje podwójną rezerwację i proponuje inny termin.
3. **Given** gracz opłacił rezerwację, **When** anuluje ją w oknie polityki anulacji, **Then** otrzymuje zwrot zgodny z zasadami klubu, a slot wraca do puli.

---

### User Story 2 - Karta klubu, liga i ranking na żywo (znak firmowy / silnik lock-in) (Priority: P1)

Przy pierwszej wizycie gracz dostaje od klubu **fizyczną, brandowaną kartę klubu** z unikalnym kodem. Zeskanowanie karty dołącza go do klubu i jego lig — od tej chwili każda gierka i turniej rozegrane „u nas" (skan karty lub rezerwacja przez apkę) automatycznie zasilają **żywy ranking klubu** i **równoległe ligi** (tygodniowe, miesięczne, roczne). Ranking jest widoczny w aplikacji **oraz na ekranie w klubie** (TV/tablet przy recepcji). Gracz wspina się w rankingu przez samą grę, zdobywa klubowe tytuły („Król kortu #1 w [Klub]"), a sezony kończą się finałami/nagrodami. Karta w portfelu + ruch w rankingu przy każdej wizycie = codzienny nawyk i powód, by wracać właśnie do tego klubu przez PadelParty.

**Why this priority**: To jest to „coś charakterystycznego" — mechanika, która JEDNEMU klubowi daje mega zaangażowanie, zanim jeszcze jest sieć. Bez niej rezerwacje to zwykły marketplace bez lepkości.

**Independent Test**: Wręcz graczowi kartę klubu → skan dołącza go do klubu i lig → rozegraj kilka gierek/turniejów → ranking i ligi aktualizują się na żywo w apce i na widoku „ekran klubu"; gracz dostaje klubowy tytuł do pochwalenia się.

**Acceptance Scenarios**:

0. **Given** nowy gracz z kartą otrzymaną przy pierwszej wizycie, **When** skanuje kod karty w aplikacji, **Then** zostaje członkiem klubu i jest automatycznie zapisany do jego aktywnych lig.
1. **Given** aktywne ligi klubu, **When** gracze kończą gierkę przypisaną do klubu (skan karty lub rezerwacja), **Then** ich pozycje we wszystkich aktywnych ligach klubu aktualizują się natychmiast w aplikacji i na widoku ekranu klubowego.
2. **Given** koniec sezonu, **When** okres się zamyka, **Then** wyłaniany jest zwycięzca/zwycięzcy, przyznawane są tytuły/nagrody i startuje nowy sezon z zachowaniem historii.
3. **Given** gracz zdobywa czołowe miejsce lub tytuł, **When** wygrywa/awansuje, **Then** otrzymuje udostępnialne, brandowane klubem osiągnięcie.

---

### User Story 3 - Jedna tożsamość gracza w całym ekosystemie (efekt sieciowy) (Priority: P2)

Gracz ma **jeden profil**, którego statystyki, ranking, reputacja i znajomi podążają za nim do **każdego klubu** w ekosystemie. Może grać, rezerwować i wchodzić do ligi w dowolnym klubie tym samym kontem, a globalne/regionalne rankingi łączą wyniki z wielu klubów. Im więcej klubów dołącza, tym więcej gracz traci przy wyjściu (dorobek, ranking, dostęp do kortów) — to napędza lock-in.

**Why this priority**: Zamienia zbiór pojedynczych klubów w sieć. Wartość rośnie z każdym klubem (cross-side network effect), co jest głównym powodem, dla którego użytkownicy nie chcą wychodzić.

**Independent Test**: Gracz aktywny w klubie A wchodzi do klubu B → jego profil, ranking i historia są od razu dostępne, a wyniki z obu klubów wliczą się do wspólnego rankingu regionalnego.

**Acceptance Scenarios**:

1. **Given** gracz z historią w klubie A, **When** po raz pierwszy odwiedza klub B w ekosystemie, **Then** jego profil, reputacja i statystyki są od razu widoczne bez zakładania konta od nowa.
2. **Given** wyniki z wielu klubów, **When** liczony jest ranking regionalny/globalny, **Then** uwzględnia grę gracza we wszystkich klubach z uczciwym porównaniem poziomu.
3. **Given** gracz szuka gry, **When** otwiera „w pobliżu", **Then** widzi kluby, otwarte gierki i graczy o zbliżonym poziomie w okolicy.

---

### User Story 4 - Wiralowy hak marketingowy (wzrost napędzany graczami) (Priority: P2)

Osiągnięcia, tytuły i wyniki są **udostępnialne** (poza aplikacją) w brandowanej klubem formie, z zaproszeniem, które prowadzi nowego użytkownika prosto do profilu klubu i pierwszej gierki. Program **poleceń** nagradza graczy i kluby za przyciąganie nowych osób. Cykliczne wyróżnienia („Klub tygodnia", „Wspinaczka miesiąca") dają klubom darmowy, powtarzalny content marketingowy.

**Why this priority**: Obniża koszt pozyskania i sprawia, że każdy klub sam się promuje przez swoich graczy — kluczowe przy skalowaniu na świat.

**Independent Test**: Gracz udostępnia tytuł/wynik → link prowadzi nowego użytkownika do profilu klubu i rejestracji → polecenie jest przypisane i nagrodzone.

**Acceptance Scenarios**:

1. **Given** gracz zdobył udostępnialne osiągnięcie, **When** udostępnia je na zewnątrz, **Then** odbiorca po kliknięciu trafia na profil klubu i może dołączyć/zarezerwować w kilku krokach.
2. **Given** aktywny program poleceń, **When** polecony gracz dołącza i rozgrywa pierwszą gierkę, **Then** polecający (i/lub klub) otrzymuje ustaloną nagrodę.

---

### User Story 5 - Monetyzacja „wszystkiego dookoła" + panel klubu (Priority: P3)

Poza prowizją od rezerwacji platforma zarabia na **abonamentach klubów** (poziomy z dodatkowymi narzędziami), **promowanych wydarzeniach/turniejach**, oraz dodatkach dla graczy (np. płatne wejściówki na eventy, członkostwa klubowe, później: sprzęt, treningi). Klub dostaje **panel**: kalendarz rezerwacji, przychody, frekwencja, retencja graczy, narzędzia do organizacji turniejów i komunikacji z graczami.

**Why this priority**: Rozszerza przychód poza pojedynczą transakcję („sprzedajemy też wszystko dookoła") i daje klubowi twarde powody biznesowe, by zostać (widzi swoje przychody i retencję w jednym miejscu).

**Independent Test**: Klub wykupuje wyższy poziom abonamentu i promuje turniej → widzi w panelu wpływy z rezerwacji, sprzedanych wejściówek i frekwencję.

**Acceptance Scenarios**:

1. **Given** klub na wyższym poziomie abonamentu, **When** tworzy promowane wydarzenie z płatnymi miejscami, **Then** gracze mogą kupić wejście, a klub widzi sprzedaż i listę uczestników w panelu.
2. **Given** działający klub, **When** menedżer otwiera panel, **Then** widzi przychody, obłożenie kortów, liczbę aktywnych graczy i ich retencję za wybrany okres.

---

### User Story 6 - Matchmaking i otwarte gierki (Priority: P3)

Gracz może wystawić lub dołączyć do **otwartej gierki** w klubie („szukam 4. do składu", „Americano wtorek 19:00"), dobranej poziomem. To wypełnia korty, poznaje graczy między sobą i pogłębia zaangażowanie w klubie.

**Why this priority**: Zwiększa liczbę rozegranych gier (a więc rezerwacji i ruchu w rankingu) i wiąże graczy relacjami — dodatkowa warstwa lepkości, ale nie jest konieczna do startu.

**Independent Test**: Gracz tworzy otwartą gierkę z wolnym miejscem → inny gracz o zbliżonym poziomie dołącza → skład się zapełnia i (opcjonalnie) rezerwuje kort.

**Acceptance Scenarios**:

1. **Given** otwarta gierka z wolnym miejscem, **When** pasujący poziomem gracz dołącza, **Then** skład się aktualizuje, a przy komplecie można powiązać rezerwację kortu.

---

### Edge Cases

- Co się dzieje, gdy dwie osoby jednocześnie opłacają ten sam slot? (blokada podwójnej rezerwacji, zwrot dla przegranego)
- Jak system rozlicza **zwroty/anulacje** wg polityki klubu i kto ponosi prowizję przy anulacji?
- Co z klubem pilotażowym, który równolegle prowadzi zapisy poza platformą (telefon/recepcja) — jak uniknąć podwójnej sprzedaży, skoro to my jesteśmy systemem rezerwacji (proces: wszystkie terminy wchodzą przez platformę / blokady ręczne w panelu)?
- Jak porównywać poziom gracza uczciwie między klubami o różnym poziomie zawodników (kalibracja rankingu cross-klubowego)?
- Co z graczem, który należy do wielu klubów — do której ligi/sezonu wpada dana gierka? (wybór klubu przy zapisie gierki; domyślnie klub, w którym grano)
- Jak chronić przed nadużyciami poleceń (fałszywe konta dla nagród)?
- Gracz zgubił kartę klubu / karta trafiła w cudze ręce — unieważnienie i ponowne wydanie bez utraty dorobku (FR-017); jeden kod nie może być powiązany z dwoma kontami.
- Nabijanie rankingu klubowego gierkami rozegranymi poza klubem (skan karty z domu) — sygnały wiarygodności: powiązanie z rezerwacją, zgłoszenie wyniku przez wielu uczestników, możliwość moderacji przez klub.
- Co, gdy klub odchodzi z platformy — jak zachować dane graczy i ich ranking (lock-in vs przenośność danych/RODO)?
- Obsługa braku sieci przy zapisie gierki w klubie (kolejkowanie i późniejsza synchronizacja).

## Requirements *(mandatory)*

### Functional Requirements

**Kluby i korty (US1)**
- **FR-001**: System MUST umożliwić utworzenie profilu klubu (nazwa, lokalizacja, opis, logo/branding, dane do wypłat). Kluby wchodzą **wyłącznie na zaproszenie/po weryfikacji przez platformę** (model kuratorowany — brak otwartej rejestracji klubów); po zaproszeniu menedżer samodzielnie konfiguruje profil, korty i cennik.
- **FR-002**: System MUST umożliwić klubowi dodanie kortów wraz z godzinami otwarcia, długością slotów i cennikiem (w tym różne stawki np. dzień/wieczór/weekend).
- **FR-003**: System MUST prezentować graczom aktualną dostępność kortów i ceny w czasie zbliżonym do rzeczywistego.
- **FR-004**: Users (gracze) MUST być w stanie zarezerwować i opłacić slot w aplikacji z natychmiastowym potwierdzeniem. Płatność online jest częścią MVP **od dnia 1** (nie ma trybu przejściowego „płatność na miejscu").
- **FR-005**: System MUST zapobiegać podwójnej rezerwacji tego samego slotu.
- **FR-006**: System MUST monetyzować rezerwacje **dwutorowo**: (a) **prowizją** platformy od każdej opłaconej rezerwacji oraz (b) **abonamentem klubu w poziomach** (plan darmowy/podstawowy + wyższe plany z dodatkowymi narzędziami). System MUST naliczać i ewidencjonować prowizję oraz udostępniać klubowi rozliczenie należności.
- **FR-007**: System MUST obsługiwać anulacje i zwroty zgodnie z polityką anulacji ustaloną przez klub.
- **FR-008**: System MUST być **jedynym źródłem prawdy** o dostępności kortów klubu (platforma jest podstawowym systemem rezerwacji klubu; brak zależności od zewnętrznych systemów w v1) i zapobiegać podwójnej sprzedaży tego samego slotu. Integracje z zewnętrznymi systemami rezerwacji są poza zakresem v1 (możliwe rozszerzenie w przyszłości).

**Liga klubu i ranking na żywo (US2)**
- **FR-010**: System MUST pozwolić klubowi prowadzić **wiele lig/sezonów równolegle, o różnych cyklach** (tygodniowy, miesięczny, roczny — jednocześnie), z automatycznym zapisem graczy klubu do lig.
- **FR-011**: System MUST liczyć i aktualizować **ranking klubu na żywo** na podstawie gierek i turniejów rozegranych w tym klubie, natychmiast po zapisaniu wyniku; jeden wynik zasila **wszystkie aktywne ligi** klubu, w których uczestniczy gracz.
- **FR-012**: System MUST udostępniać **widok „ekran klubu"** (do wyświetlenia na TV/tablecie w lokalu) z żywym rankingiem i bieżącymi meczami.
- **FR-013**: System MUST wyłaniać zwycięzców sezonu, przyznawać **klubowe tytuły/nagrody** i archiwizować historię sezonów.
- **FR-014**: System MUST generować udostępnialne, brandowane klubem osiągnięcia dla graczy (tytuły, awanse, rekordy).
- **FR-015**: System MUST obsługiwać **fizyczne karty klubu** z unikalnymi kodami: klub generuje/zamawia pulę kart w panelu, wręcza kartę przy pierwszej wizycie, a zeskanowanie kodu przez gracza dołącza go do klubu i jego aktywnych lig.
- **FR-016**: System MUST przypisywać gierkę do klubu na podstawie **skanu karty klubu** przy zapisie wyniku **lub automatycznie z rezerwacji** kortu w tym klubie; gierki bez żadnego z tych sygnałów nie zasilają rankingu klubu.
- **FR-017**: System MUST umożliwiać unieważnienie i ponowne wydanie karty (zgubiona/skradziona) bez utraty dorobku gracza w klubie.

**Tożsamość i sieć (US3)**
- **FR-020**: System MUST zapewnić graczowi **jedną tożsamość** działającą we wszystkich klubach ekosystemu (bez zakładania konta od nowa w każdym klubie).
- **FR-021**: System MUST przenosić statystyki, ranking i reputację gracza między klubami.
- **FR-022**: System MUST liczyć **rankingi regionalne/globalne** łączące wyniki z wielu klubów z uczciwą kalibracją poziomu.
- **FR-023**: Users MUST móc odkrywać kluby, otwarte gierki i graczy „w pobliżu" wg lokalizacji i poziomu.
- **FR-024**: System MUST pozwolić graczowi na przynależność do wielu klubów (wiele kart klubowych na jednym koncie) i przypisywać gierkę do właściwego klubu wg FR-016.

**Wiral i wzrost (US4)**
- **FR-030**: System MUST umożliwiać udostępnianie osiągnięć/wyników na zewnątrz z linkiem prowadzącym do profilu klubu i szybkiego dołączenia/rezerwacji.
- **FR-031**: System MUST prowadzić program poleceń z atrybucją i nagrodami dla polecającego i/lub klubu, z zabezpieczeniem przed nadużyciami.
- **FR-032**: System MUST generować cykliczne wyróżnienia (np. „Klub tygodnia", „Wspinaczka miesiąca") jako materiał marketingowy.

**Monetyzacja dookoła i panel klubu (US5)**
- **FR-040**: System MUST oferować klubom **poziomy abonamentu** odblokowujące dodatkowe narzędzia. Abonament jest **komplementarnym** źródłem przychodu wobec prowizji od rezerwacji (FR-006) — plan wejściowy tani/darmowy, wyższe plany płatne.
- **FR-041**: System MUST umożliwiać tworzenie **promowanych/płatnych wydarzeń i turniejów** ze sprzedażą miejsc.
- **FR-042**: System MUST dostarczać klubowi **panel** z przychodami, obłożeniem kortów, liczbą i retencją graczy oraz narzędziami do organizacji turniejów.
- **FR-043**: System SHOULD przewidywać przyszłe strumienie przychodu „dookoła" (np. członkostwa, sprzęt, treningi) jako rozszerzalne kategorie oferty.

**Matchmaking (US6)**
- **FR-050**: Users MUST móc tworzyć i dołączać do otwartych gierek dobieranych poziomem, z opcją powiązania rezerwacji kortu przy komplecie składu.

**Przekrojowe**
- **FR-060**: System MUST obsługiwać płatności i wypłaty do klubów. Zasięg startowy: **MVP z jednym pilotażowym klubem**, następnie **Warszawa** (rynek: Polska, waluta PLN, język polski). Architektura MUST być gotowa na późniejszą ekspansję na kolejne miasta/kraje bez przebudowy.
- **FR-061**: System MUST działać w istniejącej apce gracza (mobilna) oraz udostępniać klubom narzędzia zarządcze (panel + widok ekranu klubu).
- **FR-062**: System MUST zachować zgodność z ochroną danych osobowych, w tym prawo gracza do przenoszenia/usunięcia danych, niezależnie od mechanik lock-in.
- **FR-063**: System MUST rejestrować zdarzenia finansowe (rezerwacje, prowizje, zwroty, wypłaty) w sposób umożliwiający rozliczenia i audyt.
- **FR-064**: Konta menedżerów klubów MUST wymagać e-maila, silnego hasła i **obowiązkowego uwierzytelniania dwuskładnikowego (2FA)** od pierwszego logowania. Konta graczy pozostają niskotarciowe (login + hasło).
- **FR-065**: Produkt MUST używać terminu **„login"** (nie „ksywa") we wszystkich tekstach interfejsu i komunikatach.

### Key Entities *(include if feature involves data)*

- **Klub**: lokal padlowy; nazwa, lokalizacja, branding, dane wypłat, polityka anulacji, poziom abonamentu.
- **Kort**: fizyczny kort w klubie; godziny, długość slotu, cennik.
- **Slot / Dostępność**: konkretny przedział czasu na korcie, wolny lub zajęty.
- **Rezerwacja**: powiązanie gracza, slotu i płatności; status (opłacona/anulowana/zrealizowana).
- **Płatność / Prowizja / Wypłata**: przepływy pieniężne między graczem, platformą a klubem.
- **Gracz (rozszerzony)**: istniejący profil + przynależność do klubów, poziom, reputacja, ranking cross-klubowy.
- **Karta klubu**: fizyczna, brandowana karta z unikalnym kodem; wręczana przy pierwszej wizycie; dołącza gracza do klubu/lig i służy do przypisywania gierek; może być unieważniona i wydana ponownie.
- **Członkostwo w klubie**: relacja gracz–klub (od kiedy, rola, status w lidze, powiązana karta).
- **Sezon / Liga**: cykl rywalizacji w klubie z rankingiem i finałem; klub może prowadzić **wiele równoległych lig o różnych cyklach** (tygodniowa/miesięczna/roczna).
- **Ranking klubu / regionalny / globalny**: klasyfikacje na różnych poziomach agregacji.
- **Osiągnięcie / Tytuł / Odznaka**: udostępnialny dorobek gracza, brandowany klubem.
- **Polecenie**: atrybucja pozyskania nowego użytkownika + nagroda.
- **Abonament / Plan klubu**: poziom usługi i odblokowane narzędzia.
- **Wydarzenie / Turniej (płatny)**: promowane wydarzenie ze sprzedażą miejsc.
- **Otwarta gierka**: zaproszenie do gry z wolnymi miejscami i doborem poziomu.
- **Region / Lokalizacja**: jednostka geograficzna dla odkrywania i rankingów.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Klub — od przyjęcia zaproszenia — jest w stanie w pełni się skonfigurować (profil + korty + cennik) i opublikować pierwsze wolne terminy w **mniej niż 30 minut**.
- **SC-002**: Gracz może znaleźć i opłacić rezerwację kortu w **mniej niż 2 minuty**, a skuteczność ukończenia rezerwacji przekracza **90%**.
- **SC-003**: W klubie z aktywną ligą **≥ 60%** grających w danym miesiącu rozegrało co najmniej jedną gierkę zapisaną w klubie (dowód zaangażowania przez mechanikę ligi).
- **SC-004**: Retencja graczy klubu miesiąc-do-miesiąca (M1) **≥ 40%**, wyraźnie wyższa niż przed włączeniem ligi/rankingu.
- **SC-005**: Ranking klubu i liga aktualizują się **natychmiast po** zapisaniu wyniku (odczuwalnie „na żywo") w apce i na ekranie klubu.
- **SC-006**: Co najmniej **1 na 4** nowych graczy pochodzi z udostępnień/poleceń istniejących graczy (wzrost napędzany produktem).
- **SC-007**: Miesięczny **churn klubów < 3%** po pierwszym pełnym sezonie ligi (dowód lock-inu po stronie klubu).
- **SC-008**: Wraz ze wzrostem liczby klubów w regionie rośnie odsetek graczy grających w **więcej niż jednym klubie** (dowód efektu sieciowego), osiągając **≥ 25%** w dojrzałym regionie.
- **SC-009**: Średni **przychód platformy na aktywny klub** rośnie kwartał-do-kwartału dzięki rezerwacjom i przychodom „dookoła".
- **SC-010**: System obsługuje jednoczesną aktywność wielu klubów i graczy bez zauważalnego spadku wydajności przy rezerwacjach i aktualizacji rankingów na żywo.

## Assumptions

- Bazuje na istniejącej apce PadelParty (konta bez maili, gierki, tryby Americano/Mexicano, turnieje round-by-round) — profil gracza i logika rankingu są rozszerzane, nie budowane od zera.
- „Coś charakterystycznego" i mechanika lock-in są zdefiniowane jako **fizyczna karta klubu (wręczana przy pierwszej wizycie) + równoległe ligi klubu + ranking na żywo + widok ekranu klubu + udostępnialne tytuły brandowane klubem** (US2) — świadoma decyzja produktowa potwierdzona w Clarifications.
- Rezerwacja dotyczy **kortów padlowych** (nie generyczny booking); jednostką sprzedaży jest slot na korcie.
- Model monetyzacji: **prowizja od rezerwacji + abonamenty klubów w poziomach** (potwierdzone — FR-006/FR-040).
- Start: **MVP z jednym pilotażowym klubem → Warszawa** (Polska, PLN, PL), architektura gotowa na dalszą ekspansję (potwierdzone — FR-060).
- Platforma jest **jedynym systemem rezerwacji** klubu w v1; brak integracji z zewnętrznymi systemami na start (potwierdzone — FR-008).
- Płatności realizowane przez zewnętrznego, standardowego operatora płatności (szczegóły w fazie planu, nie w specyfikacji).
- Widok „ekran klubu" to tryb wyświetlania (np. przeglądarka na TV/tablecie), nie osobne urządzenie sprzętowe.
- Zgodność z RODO i prawo do przenoszenia danych mają pierwszeństwo nad mechanikami retencyjnymi (lock-in przez wartość, nie przez uwięzienie danych).
