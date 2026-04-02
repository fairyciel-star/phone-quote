import { useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import { Card } from '../ui/Card';
import { StepNavigation } from '../layout/StepNavigation';
import phonesData from '../../data/phones.json';
import type { Phone } from '../../types';
import { formatWon } from '../../utils/format';
import styles from './Step3Phone.module.css';

const phones = phonesData as unknown as Phone[];

type BrandFilter = '전체' | '삼성' | 'Apple';

export function Step3Phone() {
  const carrierId = useQuoteStore((s) => s.carrierId);
  const subscriptionType = useQuoteStore((s) => s.subscriptionType);
  const selectedPhoneId = useQuoteStore((s) => s.selectedPhoneId);
  const selectedStorage = useQuoteStore((s) => s.selectedStorage);
  const setPhone = useQuoteStore((s) => s.setPhone);
  const setStorage = useQuoteStore((s) => s.setStorage);

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);
  const getPhoneBadge = useSheetStore((s) => s.getPhoneBadge);

  const [brandFilter, setBrandFilter] = useState<BrandFilter>('전체');

  const carrierPhones = phones.filter((p) => p.carriers.includes(carrierId!));
  const filteredPhones = brandFilter === '전체'
    ? carrierPhones
    : carrierPhones.filter((p) => p.brand === brandFilter);

  // 시트에서 출고가 가져오기 (첫번째 용량 기준 최저가 표시)
  const getSheetPrice = (phone: Phone, storageSize: string): number => {
    if (!sheetLoaded || !carrierId || !subscriptionType) return 0;
    const sheet = getSubsidy(phone.id, carrierId, storageSize, subscriptionType);
    return sheet.출고가;
  };

  const getDisplayPrice = (phone: Phone, storageSize: string): number => {
    const sheetPrice = getSheetPrice(phone, storageSize);
    if (sheetPrice > 0) return sheetPrice;
    const storage = phone.storage.find((s) => s.size === storageSize);
    return storage?.price ?? 0;
  };

  const canProceed = selectedPhoneId !== null && selectedStorage !== null;

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>모델 선택</h2>
        <p className={styles.subtitle}>원하시는 기기를 선택해주세요</p>

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

        <div className={styles.list}>
          {filteredPhones.map((phone) => {
            const isSelected = selectedPhoneId === phone.id;
            const lowestPrice = getDisplayPrice(phone, phone.storage[0].size);
            return (
              <div key={phone.id}>
                <Card
                  selected={isSelected}
                  onClick={() => setPhone(phone.id)}
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
                        {sheetLoaded && carrierId && (() => {
                          const badge = getPhoneBadge(phone.id, carrierId);
                          if (!badge) return null;
                          return (
                            <span className={`${styles.badge} ${badge === 'NEW' ? styles.badgeNew : styles.badgeEvent}`}>
                              {badge}
                            </span>
                          );
                        })()}
                      </div>
                      <span className={styles.phonePrice}>
                        {formatWon(lowestPrice)}~
                      </span>
                    </div>
                  </div>
                </Card>

                {isSelected && (
                  <div className={styles.storagePanel}>
                    <div className={styles.storageLabel}>용량 선택</div>
                    <div className={styles.storageOptions}>
                      {phone.storage.map((storage) => {
                        const price = getDisplayPrice(phone, storage.size);
                        return (
                          <button
                            key={storage.size}
                            className={`${styles.storagePill} ${selectedStorage === storage.size ? styles.selectedStorage : ''}`}
                            onClick={() => setStorage(storage.size)}
                          >
                            {storage.size}
                            <span className={styles.storagePrice}>{formatWon(price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <StepNavigation canProceed={canProceed} />
    </>
  );
}
