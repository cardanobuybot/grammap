import type { SeoLang } from '@/lib/seo-content';

/** Terms and privacy, one language per address (/terms and /ru/terms). */

export const termsHead: Record<SeoLang, { title: string; description: string }> = {
  en: {
    title: 'Terms and privacy — GramMap',
    description: 'What a plot on GramMap is, how payment works, the content rules and what data the site keeps.',
  },
  ru: {
    title: 'Условия и конфиденциальность — GramMap',
    description: 'Что такое участок на GramMap, как устроена оплата, правила для контента и какие данные хранит сайт.',
  },
};

function English() {
  return (
    <>
      <h1>GramMap terms</h1>
      <p className="doc__lead">By buying or editing a plot on GramMap you agree to the following.</p>

      <h2>What you buy</h2>
      <p>
        A plot is a rectangle of pixels on the GramMap sheet. Paying for it lets you show a picture, a title and a link
        there. It is advertising space on this website: not a token, not an NFT and not an investment. GramMap promises
        no income from it.
      </p>

      <h2>Payment</h2>
      <p>
        Payments are made in GRAM on the TON blockchain, directly from your wallet to the GramMap address shown on the
        site. A payment gets the area named in its comment if that area is still free when the payment reaches the
        network. Blockchain payments cannot be reversed.
      </p>
      <p>
        A payment that could not be applied, for example because someone else&apos;s payment for the same area arrived
        first, appears on the public refund list and is returned by hand, less network fees. Pay only from your own
        wallet: a payment sent from an exchange gives the plot to the exchange.
      </p>

      <h2>Content rules</h2>
      <p>
        You are responsible for what you place on your plot. Not allowed: anything illegal, adult content, scams and
        phishing, malware, hatred or harassment, and imitating someone else&apos;s brand or project. A plot that breaks
        these rules has its picture and link hidden, and the purchase is not refunded.
      </p>

      <h2>Links</h2>
      <p>
        Links on the map are added by plot owners. GramMap does not check or endorse them. Open them at your own risk.
      </p>

      <h2>Availability</h2>
      <p>
        The site is provided as is and may be changed, paused or closed. The list of plots and their owners is derived
        from public blockchain transactions.
      </p>

      <h2 id="privacy">Privacy</h2>
      <p>
        GramMap has no accounts and does not ask for your name, email or phone number. It stores the pictures, titles
        and links you submit, and reads what is public on the TON blockchain anyway: wallet addresses, amounts and
        payment comments. Your browser keeps your language choice and, through TON Connect, your wallet session. The
        site is hosted on Vercel, which processes technical request data such as IP addresses to deliver pages.
      </p>
    </>
  );
}

function Russian() {
  return (
    <>
      <h1>Условия GramMap</h1>
      <p className="doc__lead">Покупая или редактируя участок на GramMap, вы соглашаетесь со следующим.</p>

      <h2>Что вы покупаете</h2>
      <p>
        Участок — это прямоугольник пикселей на листе GramMap. Оплатив его, вы можете показывать там картинку, название
        и ссылку. Это рекламное место на сайте: не токен, не NFT и не инвестиция. GramMap не обещает с него никакого
        дохода.
      </p>

      <h2>Оплата</h2>
      <p>
        Оплата идёт в GRAM в блокчейне TON, напрямую с вашего кошелька на адрес GramMap, указанный на сайте. Платёж
        получает участок, записанный в его комментарии, если этот участок ещё свободен в момент, когда платёж дошёл до
        сети. Платежи в блокчейне нельзя отменить.
      </p>
      <p>
        Платёж, который не удалось применить — например, чужой платёж за тот же участок пришёл раньше, — попадает в
        публичный список на возврат и возвращается вручную за вычетом комиссии сети. Платите только со своего кошелька:
        если отправить платёж с биржи, участок достанется бирже.
      </p>

      <h2>Правила для контента</h2>
      <p>
        За содержимое участка отвечаете вы. Нельзя: всё незаконное, взрослый контент, мошенничество и фишинг,
        вредоносные программы, ненависть и травлю, подделку под чужой бренд или проект. У участка с нарушением картинка
        и ссылка скрываются, покупка не возвращается.
      </p>

      <h2>Ссылки</h2>
      <p>
        Ссылки на карте добавляют владельцы участков. GramMap их не проверяет и не рекомендует. Переходите по ним на
        свой риск.
      </p>

      <h2>Доступность</h2>
      <p>
        Сайт предоставляется как есть и может быть изменён, приостановлен или закрыт. Список участков и их владельцев
        строится по публичным транзакциям блокчейна.
      </p>

      <h2 id="privacy">Конфиденциальность</h2>
      <p>
        На GramMap нет аккаунтов, сайт не спрашивает имя, почту или телефон. Он хранит картинки, названия и ссылки,
        которые вы отправили, и читает то, что и так публично в блокчейне TON: адреса кошельков, суммы и комментарии к
        платежам. Браузер хранит выбранный язык и — через TON Connect — сессию кошелька. Сайт размещён на Vercel,
        который обрабатывает технические данные запросов, например IP-адреса, чтобы отдавать страницы.
      </p>
    </>
  );
}

export function TermsText({ lang }: { lang: SeoLang }) {
  return lang === 'ru' ? <Russian /> : <English />;
}
