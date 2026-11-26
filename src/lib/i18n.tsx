'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ru';

const en = {
  'brand.tagline': 'Pixel map on TON',
  'plate.sub': '{total} pixels on TON. One pixel costs {price} GRAM.',

  'cta.buy': 'Buy pixels',
  'cta.closed': 'Sales open soon',
  'cta.price': '1 px = {price} GRAM',
  'wallet.connect': 'Connect wallet',
  'wallet.connectShort': 'Connect',

  'block.sold': 'Sold {n} of {total} px',
  'block.stale': 'Could not reach the network. The map may be out of date.',
  'block.loading': 'Loading the map…',
  'probe.free': 'Pixel {x}, {y} is free',
  'probe.buyHere': 'Buy here',

  'select.hint': 'Drag on the map to mark the area you want.',
  'select.hintTouch': 'Drag to mark the area you want. Use two fingers to move the map.',
  'select.width': 'Width',
  'select.height': 'Height',
  'select.less': 'Smaller',
  'select.more': 'Larger',
  'select.continue': 'Continue',
  'select.cancel': 'Cancel',
  'select.free': 'This area is free.',
  'problem.taken': 'Part of this area is already sold. Move or shrink the selection.',
  'problem.reserved': 'This area holds the map title and is not for sale.',
  'problem.too_large': 'Too large for one purchase: up to {side} px per side and {area} px in total.',
  'problem.out_of_bounds': 'The selection goes beyond the edge of the map.',

  'form.buyTitle': 'Your plot: {w} × {h} px',
  'form.editTitle': 'Change picture and link',
  'form.image': 'Picture',
  'form.imagePick': 'Choose a picture',
  'form.imageReplace': 'Choose another',
  'form.imageRemove': 'Remove',
  'form.imageHint': 'PNG, JPG, WebP or GIF. It is cropped to the shape of the plot.',
  'form.title': 'Title',
  'form.titlePh': 'Project or channel name',
  'form.link': 'Link',
  'form.linkHint': 'Opens when someone taps your plot. https only.',
  'form.later': 'You can leave everything empty and add it later for {fee} GRAM.',
  'form.clear': 'Leaving everything empty removes the current picture and link.',
  'form.same': 'Nothing has changed yet.',
  'form.total': 'Total',
  'form.pay': 'Pay {price} GRAM',
  'form.payEdit': 'Save for {fee} GRAM',
  'form.connectFirst': 'Connect wallet to pay',
  'form.rules':
    'By paying you accept the rules: no illegal, adult or deceptive content. A plot that breaks them is hidden without a refund.',
  'form.back': 'Back to the map',

  'pay.preparing': 'Preparing the payment…',
  'pay.wallet': 'Confirm the payment in your wallet.',
  'pay.confirming': 'Payment sent. Waiting for the network to confirm it, usually under a minute.',
  'pay.done.buy': 'The plot is yours.',
  'pay.done.edit': 'Saved. Your plot is updated.',
  'pay.show': 'Show on the map',
  'pay.close': 'Close',
  'pay.retry': 'Try again',
  'pay.cancelled': 'Payment cancelled in the wallet.',
  'pay.slow':
    'The network is taking longer than usual. Your payment is not lost: the map updates as soon as it is confirmed. You can close this window.',
  'pay.rejected.taken':
    'Someone bought part of this area a moment before you. Your payment is on the refund list and will be returned.',
  'pay.rejected.other':
    'The payment arrived but could not be applied: {reason}. It is on the refund list and will be returned.',
  'pay.error.network': 'Your wallet is on a different network. Switch it to {network} and try again.',
  'pay.error.generic': 'Could not start the payment. Try again.',

  'error.rate_limited': 'Too many requests. Wait a minute and try again.',
  'error.unavailable': 'The server is not available right now. Try again in a minute.',
  'error.storage': 'The server is not available right now. Try again in a minute.',
  'error.offline': 'No connection. Check the internet and try again.',
  'error.title_required': 'Add a title. It is shown together with your picture.',
  'error.title_too_long': 'The title is too long: up to 60 characters.',
  'error.url_invalid': 'The link must be a full https address.',
  'error.url_too_long': 'The link is too long: up to 200 characters.',
  'error.image_invalid': 'This file is not a picture we can read. Use PNG, JPG, WebP or GIF.',
  'error.image_too_large': 'The picture is too large. Choose a smaller one.',
  'error.content_missing': 'The picture was not saved. Try again.',
  'error.sales_closed': 'Sales are not open yet.',
  'error.no_plot': 'This plot no longer exists on the map.',
  'error.bad_request': 'Something in the request was wrong. Reload the page and try again.',

  'plot.owner': 'Owner',
  'plot.size': 'Size',
  'plot.position': 'Position',
  'plot.bought': 'Bought',
  'plot.paid': 'Paid',
  'plot.open': 'Open {host}',
  'plot.noContent': 'The owner has not added a picture yet.',
  'plot.hidden': 'The picture and link of this plot are hidden by a moderator.',
  'plot.edit': 'Change picture and link',
  'plot.share': 'Copy link to this plot',
  'plot.copied': 'Link copied',
  'plot.yours': 'Your plot',
  'plot.untitled': 'Plot {x}, {y}',

  'leave.title': 'You are leaving GramMap',
  'leave.text': 'This link was added by the plot owner. GramMap does not check where it leads.',
  'leave.go': 'Open {host}',
  'leave.stay': 'Stay on the map',

  'menu.title': 'Menu',
  'menu.mine': 'My plots',
  'menu.stats': 'Statistics',
  'menu.about': 'How it works and rules',
  'menu.refunds': 'Refund list',
  'menu.language': 'Language',
  'menu.disconnect': 'Disconnect wallet',
  'menu.telegram': 'Telegram channel',
  'menu.terms': 'Terms and privacy',

  'mine.empty': 'No plots yet. Pick a free spot on the map.',
  'mine.connect': 'Connect your wallet to see your plots.',

  'stats.sold': 'Pixels sold',
  'stats.share': 'Of the map',
  'stats.owners': 'Owners',
  'stats.volume': 'Paid in total',
  'stats.top': 'Largest owners',
  'stats.recent': 'Latest purchases',
  'stats.empty': 'Nothing is sold yet. The first plot can be yours.',
  'stats.px': '{n} px',

  'refunds.text': 'Payments that reached the GramMap address but could not be applied. They are returned to the sender by hand.',
  'refunds.empty': 'No payments are waiting for a refund.',
  'reason.taken': 'the area was already sold',
  'reason.underpaid': 'the amount was too small',
  'reason.out_of_bounds': 'the area is outside the map',
  'reason.too_large': 'the area is too large',
  'reason.reserved': 'the area is not for sale',
  'reason.malformed': 'the payment comment could not be read',
  'reason.no_plot': 'there is no such plot',
  'reason.not_owner': 'the sender does not own the plot',

  'tools.zoomIn': 'Zoom in',
  'tools.zoomOut': 'Zoom out',
  'tools.fit': 'Show the whole map',
  'tools.find': 'Go to a pixel',
  'find.go': 'Go',
  'map.label': 'Pixel map. Drag to move, pinch or scroll to zoom.',
  'close': 'Close',

  'about.lead': 'GramMap is a sheet of {total} pixels on TON. Buy an area, put your picture and link on it, and it stays yours.',
  'about.how': 'How to buy',
  'about.step1': 'Press “Buy pixels” and mark an area on the map.',
  'about.step2': 'Add a picture, a title and a link, or leave them for later.',
  'about.step3': 'Pay from your TON wallet. The plot appears when the network confirms the payment, usually within a minute.',
  'about.price': 'Prices',
  'about.priceText': 'One pixel costs {price} GRAM. Changing the picture or link later costs {fee} GRAM.',
  'about.pay': 'How payment works',
  'about.payText':
    'You pay straight from your wallet to the GramMap address. The payment comment says which area you are buying, and the first payment to reach the network gets it. GramMap never has access to your wallet.',
  'about.payWarn': 'Pay only through this site and from your own wallet. A payment sent from an exchange gives the plot to the exchange.',
  'about.payRefund': 'If two people pay for the same area, the later payment goes on the refund list and is returned by hand.',
  'about.address': 'GramMap address',
  'about.rules': 'Rules',
  'about.rulesText':
    'No illegal or adult content, no scams, no pretending to be someone else’s project. A plot that breaks the rules is hidden without a refund. Links are added by owners; GramMap does not check them.',
  'about.honest': 'A plot is advertising space on this map. It is not an investment, and GramMap promises no income from it.',
};

type Key = keyof typeof en;

const ru: Record<Key, string> = {
  'brand.tagline': 'Пиксельная карта в сети TON',
  'plate.sub': '{total} пикселей в сети TON. Один пиксель — {price} GRAM.',

  'cta.buy': 'Купить пиксели',
  'cta.closed': 'Продажи скоро откроются',
  'cta.price': '1 px = {price} GRAM',
  'wallet.connect': 'Подключить кошелёк',
  'wallet.connectShort': 'Подключить',

  'block.sold': 'Продано {n} из {total} px',
  'block.stale': 'Не удалось связаться с сетью. Карта может быть устаревшей.',
  'block.loading': 'Загружаем карту…',
  'probe.free': 'Пиксель {x}, {y} свободен',
  'probe.buyHere': 'Купить здесь',

  'select.hint': 'Проведите по карте, чтобы отметить нужный участок.',
  'select.hintTouch': 'Проведите пальцем, чтобы отметить участок. Двумя пальцами — двигать карту.',
  'select.width': 'Ширина',
  'select.height': 'Высота',
  'select.less': 'Меньше',
  'select.more': 'Больше',
  'select.continue': 'Продолжить',
  'select.cancel': 'Отмена',
  'select.free': 'Участок свободен.',
  'problem.taken': 'Часть участка уже продана. Сдвиньте или уменьшите выделение.',
  'problem.reserved': 'Здесь заголовок карты, это место не продаётся.',
  'problem.too_large': 'Слишком много для одной покупки: до {side} px по стороне и до {area} px всего.',
  'problem.out_of_bounds': 'Выделение выходит за край карты.',

  'form.buyTitle': 'Ваш участок: {w} × {h} px',
  'form.editTitle': 'Изменить картинку и ссылку',
  'form.image': 'Картинка',
  'form.imagePick': 'Выбрать картинку',
  'form.imageReplace': 'Выбрать другую',
  'form.imageRemove': 'Убрать',
  'form.imageHint': 'PNG, JPG, WebP или GIF. Обрежется по форме участка.',
  'form.title': 'Название',
  'form.titlePh': 'Название проекта или канала',
  'form.link': 'Ссылка',
  'form.linkHint': 'Откроется, когда кто-то нажмёт на ваш участок. Только https.',
  'form.later': 'Можно оставить всё пустым и добавить позже за {fee} GRAM.',
  'form.clear': 'Если оставить всё пустым, текущая картинка и ссылка будут убраны.',
  'form.same': 'Пока ничего не изменилось.',
  'form.total': 'Итого',
  'form.pay': 'Оплатить {price} GRAM',
  'form.payEdit': 'Сохранить за {fee} GRAM',
  'form.connectFirst': 'Подключить кошелёк для оплаты',
  'form.rules':
    'Оплачивая, вы принимаете правила: без незаконного, взрослого и обманного контента. Участок с нарушением скрывается без возврата.',
  'form.back': 'Назад к карте',

  'pay.preparing': 'Готовим платёж…',
  'pay.wallet': 'Подтвердите платёж в кошельке.',
  'pay.confirming': 'Платёж отправлен. Ждём подтверждения сети — обычно меньше минуты.',
  'pay.done.buy': 'Участок ваш.',
  'pay.done.edit': 'Сохранено. Участок обновлён.',
  'pay.show': 'Показать на карте',
  'pay.close': 'Закрыть',
  'pay.retry': 'Попробовать снова',
  'pay.cancelled': 'Платёж отменён в кошельке.',
  'pay.slow':
    'Сеть отвечает дольше обычного. Платёж не потерян: карта обновится, как только он подтвердится. Окно можно закрыть.',
  'pay.rejected.taken':
    'Кто-то купил часть этого участка на мгновение раньше. Ваш платёж в списке на возврат и будет возвращён.',
  'pay.rejected.other': 'Платёж пришёл, но не был применён: {reason}. Он в списке на возврат и будет возвращён.',
  'pay.error.network': 'Кошелёк подключён к другой сети. Переключите его на {network} и попробуйте снова.',
  'pay.error.generic': 'Не удалось начать оплату. Попробуйте ещё раз.',

  'error.rate_limited': 'Слишком много запросов. Подождите минуту и попробуйте снова.',
  'error.unavailable': 'Сервер сейчас недоступен. Попробуйте через минуту.',
  'error.storage': 'Сервер сейчас недоступен. Попробуйте через минуту.',
  'error.offline': 'Нет соединения. Проверьте интернет и попробуйте снова.',
  'error.title_required': 'Добавьте название — оно показывается вместе с картинкой.',
  'error.title_too_long': 'Название слишком длинное: до 60 символов.',
  'error.url_invalid': 'Ссылка должна быть полным адресом с https.',
  'error.url_too_long': 'Ссылка слишком длинная: до 200 символов.',
  'error.image_invalid': 'Этот файл не читается как картинка. Подойдут PNG, JPG, WebP и GIF.',
  'error.image_too_large': 'Картинка слишком большая. Выберите поменьше.',
  'error.content_missing': 'Картинка не сохранилась. Попробуйте ещё раз.',
  'error.sales_closed': 'Продажи ещё не открыты.',
  'error.no_plot': 'Этого участка больше нет на карте.',
  'error.bad_request': 'В запросе что-то не так. Обновите страницу и попробуйте снова.',

  'plot.owner': 'Владелец',
  'plot.size': 'Размер',
  'plot.position': 'Координаты',
  'plot.bought': 'Куплен',
  'plot.paid': 'Оплачено',
  'plot.open': 'Открыть {host}',
  'plot.noContent': 'Владелец ещё не добавил картинку.',
  'plot.hidden': 'Картинка и ссылка этого участка скрыты модератором.',
  'plot.edit': 'Изменить картинку и ссылку',
  'plot.share': 'Скопировать ссылку на участок',
  'plot.copied': 'Ссылка скопирована',
  'plot.yours': 'Ваш участок',
  'plot.untitled': 'Участок {x}, {y}',

  'leave.title': 'Вы уходите с GramMap',
  'leave.text': 'Эту ссылку добавил владелец участка. GramMap не проверяет, куда она ведёт.',
  'leave.go': 'Открыть {host}',
  'leave.stay': 'Остаться на карте',

  'menu.title': 'Меню',
  'menu.mine': 'Мои участки',
  'menu.stats': 'Статистика',
  'menu.about': 'Как это работает и правила',
  'menu.refunds': 'Список на возврат',
  'menu.language': 'Язык',
  'menu.disconnect': 'Отключить кошелёк',
  'menu.telegram': 'Телеграм-канал',
  'menu.terms': 'Условия и конфиденциальность',

  'mine.empty': 'Участков пока нет. Выберите свободное место на карте.',
  'mine.connect': 'Подключите кошелёк, чтобы увидеть свои участки.',

  'stats.sold': 'Продано пикселей',
  'stats.share': 'От всей карты',
  'stats.owners': 'Владельцев',
  'stats.volume': 'Оплачено всего',
  'stats.top': 'Крупнейшие владельцы',
  'stats.recent': 'Последние покупки',
  'stats.empty': 'Пока ничего не продано. Первый участок может стать вашим.',
  'stats.px': '{n} px',

  'refunds.text': 'Платежи, которые дошли до адреса GramMap, но не были применены. Они возвращаются отправителю вручную.',
  'refunds.empty': 'Платежей на возврат нет.',
  'reason.taken': 'участок уже был продан',
  'reason.underpaid': 'сумма была меньше нужной',
  'reason.out_of_bounds': 'участок за пределами карты',
  'reason.too_large': 'участок слишком большой',
  'reason.reserved': 'это место не продаётся',
  'reason.malformed': 'комментарий к платежу не удалось прочитать',
  'reason.no_plot': 'такого участка нет',
  'reason.not_owner': 'отправитель не владеет участком',

  'tools.zoomIn': 'Приблизить',
  'tools.zoomOut': 'Отдалить',
  'tools.fit': 'Показать всю карту',
  'tools.find': 'Перейти к пикселю',
  'find.go': 'Перейти',
  'map.label': 'Пиксельная карта. Перетаскивайте, чтобы двигать; сводите пальцы или крутите колесо, чтобы менять масштаб.',
  'close': 'Закрыть',

  'about.lead': 'GramMap — лист из {total} пикселей в сети TON. Купите участок, поставьте на него свою картинку и ссылку — он останется вашим.',
  'about.how': 'Как купить',
  'about.step1': 'Нажмите «Купить пиксели» и отметьте участок на карте.',
  'about.step2': 'Добавьте картинку, название и ссылку — или оставьте на потом.',
  'about.step3': 'Оплатите из своего TON-кошелька. Участок появится, когда сеть подтвердит платёж, — обычно в течение минуты.',
  'about.price': 'Цены',
  'about.priceText': 'Один пиксель стоит {price} GRAM. Сменить картинку или ссылку позже — {fee} GRAM.',
  'about.pay': 'Как устроена оплата',
  'about.payText':
    'Вы платите напрямую со своего кошелька на адрес GramMap. В комментарии к платежу записано, какой участок вы покупаете; его получает тот, чей платёж первым дошёл до сети. У GramMap нет доступа к вашему кошельку.',
  'about.payWarn': 'Платите только через этот сайт и со своего кошелька. Если отправить платёж с биржи, участок достанется бирже.',
  'about.payRefund': 'Если двое оплатили один и тот же участок, более поздний платёж попадает в список на возврат и возвращается вручную.',
  'about.address': 'Адрес GramMap',
  'about.rules': 'Правила',
  'about.rulesText':
    'Без незаконного и взрослого контента, без мошенничества и без подделки под чужие проекты. Участок с нарушением скрывается без возврата. Ссылки добавляют владельцы; GramMap их не проверяет.',
  'about.honest': 'Участок — это рекламное место на карте. Это не инвестиция, и GramMap не обещает с него никакого дохода.',
};

const dictionaries: Record<Lang, Record<Key, string>> = { en, ru };

export type Translate = (key: Key, params?: Record<string, string | number>) => string;

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
}

const I18nContext = createContext<I18n | null>(null);

const STORAGE_KEY = 'grammap.lang';

function initialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    /* storage can be unavailable; fall through to the browser language */
  }
  return typeof navigator !== 'undefined' && /^(ru|uk|be|kk)\b/i.test(navigator.language) ? 'ru' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the choice just will not be remembered */
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = dictionaries[lang];
    const t: Translate = (key, params) => {
      let text: string = dict[key] ?? en[key] ?? key;
      if (params) {
        for (const [name, v] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(v));
      }
      return text;
    };
    return { lang, setLang, t };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export type { Key as I18nKey };
