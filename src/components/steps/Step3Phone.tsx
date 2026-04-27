import { useMemo, useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import { Card } from '../ui/Card';
import phonesData from '../../data/phones.json';
import type { Phone, SubscriptionType } from '../../types';
import type { CarrierId } from '../../types';
import { formatWon } from '../../utils/format';
import { hapticMedium } from '../../utils/haptic';
import { calculateLowestDevicePrice } from '../../utils/price';
import styles from './Step3Phone.module.css';

const phones = phonesData as unknown as Phone[];

type BrandFilter = '전체' | '삼성' | 'Apple';

export function Step3Phone() {
  const carrierId = useQuoteStore((s) => s.carrierId);
  const subscriptionType = useQuoteStore((s) => s.subscriptionType);
  const selectedPhoneId = useQuoteStore((s) => s.selectedPhoneId);
  const setPhone = useQuoteStore((s) => s.setPhone);
  const setStorage = useQuoteStore((s) => s.setStorage);
  const setColor = useQuoteStore((s) => s.setColor);

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);

  const selectedBrand = useQuoteStore((s) => s.selectedBrand);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(
    selectedBrand === '삼성' ? '삼성' : selectedBrand === 'Apple' ? 'Apple' : '전체'
  );
  const [sortByPrice, setSortByPrice] = useState(false);

  const basePhones = carrierId
    ? phones.filter((p) => p.carriers.includes(carrierId))
    : phones;
  const filteredPhones = brandFilter === '전체'
    ? basePhones
    : basePhones.filter((p) => p.brand === brandFilter);

  // 출고가 조회 — 가입유형 무관하게 시트에서 실제 출고가를 우선 사용.
  // store의 getSubsidy가 이미 가입유형 fallback을 처리하므로 두 타입을 모두 시도.
  const getDisplayPrice = (phone: Phone, storageSize: string): number => {
    if (sheetLoaded) {
      const fallbackCarrier = (carrierId ?? phone.carriers[0]) as CarrierId;
      const subTypes: SubscriptionType[] = subscriptionType
        ? [subscriptionType, subscriptionType === '번호이동' ? '기기변경' : '번호이동']
        : ['번호이동', '기기변경'];
      for (const subType of subTypes) {
        const sheet = getSubsidy(phone.id, fallbackCarrier, storageSize, subType);
        if (sheet.출고가 > 0) return sheet.출고가;
      }
    }
    const storage = phone.storage.find((s) => s.size === storageSize);
    return storage?.price ?? 0;
  };

  const setStep = useQuoteStore((s) => s.setStep);
  const currentStep = useQuoteStore((s) => s.currentStep);

  const handleSelectPhone = (phoneId: string) => {
    hapticMedium();
    setPhone(phoneId);
    const phone = phones.find((p) => p.id === phoneId);
    if (phone?.storage.length === 1) {
      setStorage(phone.storage[0].size);
    }
    if (phone?.colors.length === 1) {
      setColor(phone.colors[0].name);
    }
    setStep(currentStep + 1);
  };

  const phonesWithData = useMemo(() =>
    filteredPhones.map((phone) => ({
      phone,
      retailPrice: getDisplayPrice(phone, phone.storage[0].size),
      lowestDevicePrice: calculateLowestDevicePrice({
        phone,
        carriers: phone.carriers,
        sheetLoaded,
        getSubsidy,
      }).price,
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filteredPhones, sheetLoaded]);

  const displayPhones = useMemo(() => {
    if (!sortByPrice) return phonesWithData;
    return [...phonesWithData].sort((a, b) => a.lowestDevicePrice - b.lowestDevicePrice);
  }, [phonesWithData, sortByPrice]);

  return (
    <>
      <div className={styles.container}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>기기를 선택해주세요!</h2>
          <button
            className={`${styles.sortBtn} ${sortByPrice ? styles.sortBtnActive : ''}`}
            onClick={() => setSortByPrice(!sortByPrice)}
          >
            최저가↑
          </button>
        </div>

        {!selectedBrand && (
          <div className={styles.brandFilter}>
            {(['전체', '삼성', 'Apple'] as const).map((brand) => (
              <button
                key={brand}
                className={`${styles.brandBtn} ${brandFilter === brand ? styles.brandBtnActive : ''}`}
                onClick={() => setBrandFilter(brand)}
              >
                {brand}
              </button>
            ))}
          </div>
        )}

        <div className={styles.list}>
          {displayPhones.map(({ phone, retailPrice, lowestDevicePrice }) => {
            const isSelected = selectedPhoneId === phone.id;
            return (
              <div key={phone.id}>
                <Card
                  selected={isSelected}
                  onClick={() => handleSelectPhone(phone.id)}
                  className={styles.phoneCard}
                >
                  <div className={styles.phoneRow}>
                    <div className={styles.phoneImage}>
                      <img
                        src={phone.image}
                        alt={phone.name}
                        className={styles.phoneImg}
                      />
                    </div>
                    <div className={styles.phoneInfo}>
                      <span className={styles.phoneBrand}>{phone.brand}</span>
                      <div className={styles.phoneNameRow}>
                        <span className={styles.phoneName}>{phone.name}</span>
                      </div>
                      <span className={styles.phonePrice}>
                        {formatWon(retailPrice)}~
                      </span>
                    </div>
                    <div className={styles.lowestPrice}>
                      <span className={styles.lowestPriceLabel}>오늘 최저가 금액</span>
                      {lowestDevicePrice > 0
                        ? <span className={styles.lowestPriceValue}>{formatWon(lowestDevicePrice)}</span>
                        : <span className={styles.lowestPriceNone}>가격 준비중</span>
                      }
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
