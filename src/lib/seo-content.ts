import { formatGrams } from './format';
import type { PublicConfig } from './types';

/**
 * Everything the site says about itself in prose, in one place: the About pages, the text
 * version of the map on the home page, llms.txt and the structured data are all built from
 * it, so search engines and AI assistants read the same facts wherever they look.
 * Figures come from the live settings, never from hard-coded text.
 */

export const SITE_URL = 'https://grammap.app';
export const SITE_NAME = 'GramMap';
/** Shown on content pages and in structured data. Bump when the copy below changes. */
export const CONTENT_UPDATED = '2026-11-26';
/** IndexNow key; the matching file lives at /<key>.txt. Public by design. */
export const INDEXNOW_KEY = '9ec1b9e95d5a0e8010c6ac16a86074fe';

export type SeoLang = 'en' | 'ru';
export const otherLang = (lang: SeoLang): SeoLang => (lang === 'en' ? 'ru' : 'en');

export interface Fact {
  label: string;
  value: string;
}

export interface Section {
  /** Anchor on the page. The same in both languages. */
  id: 'buy' | 'content' | 'payment' | 'nature' | 'rules';
  heading: string;
  paragraphs?: string[];
  steps?: string[];
}

export interface Faq {
  q: string;
  a: string;
}

export interface SiteContent {
  lang: SeoLang;
  /** Home page. */
  homeTitle: string;
  homeDescription: string;
  homeH1: string;
  /** One-sentence definition, reused wherever a short summary is needed. */
  summary: string;
  lead: string;
  /** About page. */
  aboutTitle: string;
  aboutDescription: string;
  aboutH1: string;
  factsHeading: string;
  facts: Fact[];
  sections: Section[];
  faqHeading: string;
  faq: Faq[];
  /** Interface words for the content pages. */
  ui: {
    openMap: string;
    about: string;
    terms: string;
    otherLanguage: string;
    updated: string;
    plotsHeading: string;
    plotsEmpty: string;
    soldLine: (pixels: string, plots: string, owners: string) => string;
    plotLine: (w: number, h: number, x: number, y: number) => string;
    untitled: (x: number, y: number) => string;
    address: string;
    home: string;
    /** Shown only to readers without JavaScript, above the text version of the map. */
    needsJs: string;
    navLabel: string;
    notFoundTitle: string;
    notFoundText: string;
  };
}

const number = (n: number, lang: SeoLang) => new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US').format(n);

export function siteContent(lang: SeoLang, config: PublicConfig): SiteContent {
  const total = number(config.gridW * config.gridH, lang);
  const size = `${number(config.gridW, lang)} × ${number(config.gridH, lang)}`;
  const price = formatGrams(config.pricePerPixel);
  const fee = formatGrams(config.editFee);
  const example = formatGrams(BigInt(config.pricePerPixel) * BigInt(100));
  const maxSide = number(config.maxSide, lang);
  const maxArea = number(config.maxArea, lang);

  if (lang === 'ru') {
    const summary = `GramMap — пиксельная карта в блокчейне TON: поле ${size} пикселей, где любой может купить участок за GRAM и разместить на нём картинку и ссылку.`;
    return {
      lang,
      homeTitle: 'GramMap — пиксельная карта в сети TON: купить пиксели за GRAM',
      homeDescription: `Карта из ${total} пикселей в блокчейне TON. Купите участок за GRAM прямо из кошелька (${price} GRAM за пиксель), поставьте свою картинку и ссылку — он останется вашим.`,
      homeH1: 'GramMap — пиксельная карта в сети TON',
      summary,
      lead: `GramMap — это карта из ${total} пикселей в сети TON (The Open Network). Любой, у кого есть TON-кошелёк, может купить на ней участок за GRAM и показывать там картинку, название и ссылку. Один пиксель стоит ${price} GRAM, купленный участок остаётся за покупателем.`,
      aboutTitle: 'Как устроен GramMap: купить пиксели в сети TON за GRAM',
      aboutDescription: `GramMap — карта из ${total} пикселей в сети TON: участок стоит ${price} GRAM за пиксель, на нём ваша картинка и ссылка. Цены, оплата, правила и ответы на вопросы.`,
      aboutH1: 'Как устроен GramMap',
      factsHeading: 'Коротко',
      facts: [
        { label: 'Размер карты', value: `${size} пикселей (всего ${total})` },
        { label: 'Цена', value: `${price} GRAM за пиксель` },
        { label: 'Минимальная покупка', value: '1 пиксель' },
        { label: 'Максимум за одну покупку', value: `${maxSide} пикселей по стороне, ${maxArea} пикселей всего` },
        { label: 'Смена картинки или ссылки', value: `${fee} GRAM` },
        { label: 'Блокчейн', value: 'TON (The Open Network), основная сеть' },
        { label: 'Валюта', value: 'GRAM — монета сети TON (до июня 2026 года называлась Toncoin)' },
        { label: 'Оплата', value: 'Прямой перевод со своего кошелька через TON Connect' },
        { label: 'Регистрация', value: 'Не нужна — владельца определяет адрес кошелька' },
        { label: 'Запуск', value: 'Ноябрь 2026 года' },
      ],
      sections: [
        {
          id: 'buy',
          heading: 'Как купить пиксели',
          steps: [
            'Откройте grammap.app и нажмите «Купить пиксели».',
            'Проведите по карте, чтобы отметить нужный участок. Цена показывается сразу.',
            'Добавьте картинку, название и ссылку — или оставьте поля пустыми и заполните позже.',
            'Подключите TON-кошелёк и подтвердите платёж.',
            'Участок появится на карте, когда сеть подтвердит платёж, — обычно в течение минуты.',
          ],
        },
        {
          id: 'content',
          heading: 'Что можно разместить на участке',
          paragraphs: [
            'Картинку (PNG, JPG, WebP или GIF — она обрезается по форме участка), название до 60 символов и одну ссылку с https. Посетитель, нажавший на участок, видит картинку и название и может перейти по ссылке.',
            'У каждого участка есть своя страница с адресом вида grammap.app/plot/120-340 — ей можно делиться.',
          ],
        },
        {
          id: 'payment',
          heading: 'Как устроена оплата',
          paragraphs: [
            'Вы платите напрямую со своего кошелька на адрес GramMap. В комментарии к переводу записано, какой участок вы покупаете; его получает тот, чей платёж первым дошёл до сети TON. У GramMap нет доступа к вашему кошельку и нет ключей: сайт только читает публичную запись платежей в блокчейне.',
            'Если двое оплатили один и тот же участок, более поздний платёж попадает в публичный список на возврат и возвращается вручную. Платите только через сайт и со своего кошелька: перевод с биржи отдал бы участок адресу биржи.',
          ],
        },
        {
          id: 'nature',
          heading: 'Чем участок является и чем нет',
          paragraphs: [
            'Участок — это рекламное место на карте. Это не токен, не NFT и не инвестиция, и GramMap не обещает с него никакого дохода. Передать или перепродать участок сейчас нельзя.',
          ],
        },
        {
          id: 'rules',
          heading: 'Правила',
          paragraphs: [
            'Нельзя: незаконный и взрослый контент, мошенничество и фишинг, вредоносные программы, ненависть и травлю, подделку под чужой бренд или проект. У участка с нарушением картинка и ссылка скрываются без возврата. Ссылки добавляют владельцы участков; GramMap не проверяет, куда они ведут.',
          ],
        },
      ],
      faqHeading: 'Вопросы и ответы',
      faq: [
        {
          q: 'Что такое GramMap?',
          a: `${summary} Это общая доска объявлений: чем больше пикселей вы купили, тем крупнее ваша картинка.`,
        },
        {
          q: 'Сколько стоит пиксель?',
          a: `${price} GRAM за пиксель. Участок 10 × 10 стоит ${example} GRAM. Цена одинакова в любом месте карты.`,
        },
        {
          q: 'Какие кошельки подходят?',
          a: 'Любой TON-кошелёк с поддержкой TON Connect. Нажмите на сайте «Подключить кошелёк», чтобы увидеть список, или отсканируйте QR-код приложением кошелька.',
        },
        {
          q: 'Нужна ли регистрация?',
          a: 'Нет. Ни аккаунта, ни почты, ни пароля. Участком владеет кошелёк, с которого пришёл платёж.',
        },
        {
          q: 'Можно ли потом сменить картинку или ссылку?',
          a: `Да. Владелец может в любой момент сменить картинку, название и ссылку за ${fee} GRAM — с того же кошелька, которым купил участок.`,
        },
        {
          q: 'Участок — это NFT? Его можно перепродать?',
          a: 'Нет. GramMap записывает участок по платежу в блокчейне; это не токен и не NFT, и передать или перепродать его сейчас нельзя.',
        },
        {
          q: 'Что будет, если кто-то купит тот же участок одновременно со мной?',
          a: 'Участок получает платёж, который первым дошёл до сети. Более поздний попадает в публичный список на возврат и возвращается вручную за вычетом комиссии сети.',
        },
        {
          q: 'Можно ли платить с биржи?',
          a: 'Нет. Участок принадлежит адресу, с которого пришёл платёж, поэтому перевод с биржи отдал бы его бирже. Платите со своего кошелька через сайт.',
        },
        {
          q: 'Что такое GRAM?',
          a: 'GRAM — монета блокчейна TON. До июня 2026 года она называлась Toncoin (TON); сама монета не изменилась, изменилось только название.',
        },
        {
          q: 'Что нельзя размещать на карте?',
          a: 'Незаконный и взрослый контент, мошенничество и фишинг, вредоносные программы, ненависть и травлю, подделку под чужой бренд или проект. Такие участки скрываются без возврата.',
        },
        {
          q: 'Как поделиться своим участком?',
          a: 'У каждого участка есть своя страница, например grammap.app/plot/120-340. Откройте участок на карте и нажмите «Скопировать ссылку на участок».',
        },
        {
          q: 'GramMap связан с Telegram или TON Foundation?',
          a: 'Нет. GramMap — независимый проект, который пользуется публичным блокчейном TON.',
        },
      ],
      ui: {
        openMap: 'Открыть карту',
        about: 'Как это работает',
        terms: 'Условия и конфиденциальность',
        otherLanguage: 'English',
        updated: 'Обновлено',
        plotsHeading: 'Участки на карте',
        plotsEmpty: 'Пока ничего не продано. Первый участок может стать вашим.',
        soldLine: (pixels, plots, owners) => `Продано ${pixels} из ${total} пикселей: участков — ${plots}, владельцев — ${owners}.`,
        plotLine: (w, h, x, y) => `${w} × ${h} px, координаты X ${x}, Y ${y}`,
        untitled: (x, y) => `Участок ${x}, ${y}`,
        address: 'Адрес GramMap',
        home: 'Карта',
        needsJs: 'Интерактивной карте нужен JavaScript. Ниже — её текстовая версия.',
        navLabel: 'Разделы сайта',
        notFoundTitle: 'Такой страницы нет',
        notFoundText: 'По этому адресу ничего нет. Если это ссылка на участок, возможно, его ещё не купили.',
      },
    };
  }

  const summary = `GramMap is a pixel map on the TON blockchain: a ${size} grid where anyone can buy an area for GRAM and put a picture and a link on it.`;
  return {
    lang,
    homeTitle: 'GramMap — pixel map on TON: buy pixels with GRAM',
    homeDescription: `A map of ${total} pixels on the TON blockchain. Buy an area with GRAM from your own wallet (${price} GRAM per pixel) and put your picture and link on it.`,
    homeH1: 'GramMap — pixel map on TON',
    summary,
    lead: `GramMap is a map of ${total} pixels on The Open Network (TON). Anyone with a TON wallet can buy an area of it for GRAM and show a picture, a title and a link there. One pixel costs ${price} GRAM, and a bought area stays with its buyer.`,
    aboutTitle: 'How GramMap works: buy pixels on TON with GRAM',
    aboutDescription: `GramMap is a map of ${total} pixels on TON: buy an area for ${price} GRAM per pixel and put a picture and a link on it. Prices, payment, rules and answers to questions.`,
    aboutH1: 'How GramMap works',
    factsHeading: 'Key facts',
    facts: [
      { label: 'Map size', value: `${size} pixels (${total} in total)` },
      { label: 'Price', value: `${price} GRAM per pixel` },
      { label: 'Smallest purchase', value: '1 pixel' },
      { label: 'Largest single purchase', value: `${maxSide} pixels per side, ${maxArea} pixels in total` },
      { label: 'Changing the picture or link', value: `${fee} GRAM` },
      { label: 'Blockchain', value: 'TON (The Open Network), mainnet' },
      { label: 'Currency', value: 'GRAM, the native coin of TON (called Toncoin until June 2026)' },
      { label: 'Payment', value: 'Direct transfer from your own wallet through TON Connect' },
      { label: 'Account', value: 'Not needed; the wallet address is the owner' },
      { label: 'Launched', value: 'November 2026' },
    ],
    sections: [
      {
        id: 'buy',
        heading: 'How to buy pixels',
        steps: [
          'Open grammap.app and press “Buy pixels”.',
          'Drag on the map to mark the area you want. The price is shown as you go.',
          'Add a picture, a title and a link, or leave them empty and add them later.',
          'Connect your TON wallet and confirm the payment.',
          'The area appears on the map once the network confirms the payment, usually within a minute.',
        ],
      },
      {
        id: 'content',
        heading: 'What you can show on a plot',
        paragraphs: [
          'A picture (PNG, JPG, WebP or GIF; it is cropped to the shape of your area), a title of up to 60 characters and one https link. A visitor who taps your plot sees the picture and the title and can follow the link.',
          'Every plot also has its own page with an address like grammap.app/plot/120-340, which you can share.',
        ],
      },
      {
        id: 'payment',
        heading: 'How payment works',
        paragraphs: [
          'You pay straight from your wallet to the GramMap address. The transfer carries a short comment that names the area you are buying, and the first payment to reach the TON network gets that area. GramMap has no access to your wallet and holds no keys: it only reads the public record of payments on the blockchain.',
          'If two people pay for the same area, the later payment is put on a public refund list and returned by hand. Pay only through the site and from your own wallet: a transfer from an exchange would give the plot to the exchange’s address.',
        ],
      },
      {
        id: 'nature',
        heading: 'What a plot is, and is not',
        paragraphs: [
          'A plot is advertising space on this map. It is not a token, not an NFT and not an investment, and GramMap promises no income from it. Plots cannot be transferred or resold at the moment.',
        ],
      },
      {
        id: 'rules',
        heading: 'Rules',
        paragraphs: [
          'Not allowed: illegal or adult content, scams and phishing, malware, hatred or harassment, and pretending to be someone else’s brand or project. A plot that breaks the rules has its picture and link hidden without a refund. Links are added by plot owners; GramMap does not check where they lead.',
        ],
      },
    ],
    faqHeading: 'Questions and answers',
    faq: [
      {
        q: 'What is GramMap?',
        a: `${summary} It works like a shared billboard: the more pixels you buy, the larger your picture.`,
      },
      {
        q: 'How much does a pixel cost?',
        a: `${price} GRAM per pixel. A 10 × 10 area costs ${example} GRAM. The price is the same everywhere on the map.`,
      },
      {
        q: 'Which wallets can I use?',
        a: 'Any TON wallet that supports TON Connect. Press “Connect wallet” on the site to see the list, or scan the QR code with your wallet app.',
      },
      {
        q: 'Do I need an account?',
        a: 'No. There is no registration, email or password. The wallet the payment came from owns the plot.',
      },
      {
        q: 'Can I change my picture or link later?',
        a: `Yes. The owner can change the picture, title and link at any time for ${fee} GRAM, paid from the same wallet that bought the plot.`,
      },
      {
        q: 'Is a plot an NFT? Can I resell it?',
        a: 'No. GramMap records a plot from the payment on the blockchain; it is not a token or an NFT, and it cannot be transferred or resold at the moment.',
      },
      {
        q: 'What happens if someone buys the same area at the same moment?',
        a: 'The payment that reaches the network first gets the area. The later one appears on the public refund list and is returned by hand, less the network fee.',
      },
      {
        q: 'Can I pay from an exchange?',
        a: 'No. The plot belongs to the address the payment came from, so a transfer from an exchange would give it to the exchange. Pay from your own wallet through the site.',
      },
      {
        q: 'What is GRAM?',
        a: 'GRAM is the native coin of the TON blockchain. Until June 2026 it was called Toncoin (TON); the coin itself did not change, only its name.',
      },
      {
        q: 'What is not allowed on the map?',
        a: 'Illegal or adult content, scams and phishing, malware, hatred or harassment, and pretending to be someone else’s brand or project. Such plots are hidden without a refund.',
      },
      {
        q: 'How do I share my plot?',
        a: 'Every plot has its own page, for example grammap.app/plot/120-340. Open your plot on the map and press “Copy link to this plot”.',
      },
      {
        q: 'Is GramMap connected to Telegram or the TON Foundation?',
        a: 'No. GramMap is an independent project that uses the public TON blockchain.',
      },
    ],
    ui: {
      openMap: 'Open the map',
      about: 'How it works',
      terms: 'Terms and privacy',
      otherLanguage: 'Русский',
      updated: 'Updated',
      plotsHeading: 'Plots on the map',
      plotsEmpty: 'Nothing is sold yet. The first plot can be yours.',
      soldLine: (pixels, plots, owners) => `${pixels} of ${total} pixels are sold, in ${plots} plots held by ${owners} owners.`,
      plotLine: (w, h, x, y) => `${w} × ${h} px at X ${x}, Y ${y}`,
      untitled: (x, y) => `Plot ${x}, ${y}`,
      address: 'GramMap address',
      home: 'Map',
      needsJs: 'The interactive map needs JavaScript. Below is its text version.',
      navLabel: 'Site sections',
      notFoundTitle: 'There is no such page',
      notFoundText: 'Nothing lives at this address. If it is a link to a plot, the plot may not have been bought yet.',
    },
  };
}

export { PAGES, plotPath, type PageKey } from './paths';
export const absolute = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;
