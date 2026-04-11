import { useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import { Card } from '../ui/Card';
import { StepNavigation } from '../layout/StepNavigation';
import phonesData from '../../data/phones.json';
import type { Phone } from '../../types';
import { formatWon } from '../../utils/format';
import { hapticMedium } from '../../utils/haptic';
import styles from './Step3Phone.module.css';

const phones = phonesData as unknown as Phone[];

type BrandFilter = '전체' | '삼성' | 'Apple';

export function Step3Phone() {
  const carrierId = useQuoteStore((s) => s.carrierId);
  const subscriptionType = useQuoteStore((s) => s.subscriptionType);
  const selectedPhoneId = useQuoteStore((s) => s.selectedPhoneId);
  const setPhone = useQuoteStore((s) => s.setPhone);

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);
  const getPhoneBadge = useSheetStore((s) => s.getPhoneBadge);

  const selectedBrand = useQuoteStore((s) => s.selectedBrand);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(
    selectedBrand === '삼성' ? '삼성' : selectedBrand === 'Apple' ? 'Apple' : '전체'
  );

  const basePhones = carrierId
    ? phones.filter((p) => p.carriers.includes(carrierId))
    : phones;
  const filteredPhones = brandFilter === '전체'
    ? basePhones
    : basePhones.filter((p) => p.brand === brandFilter);

  const getDisplayPrice = (phone: Phone, storageSize: string): number => {
    if (sheetLoaded && carrierId && subscriptionType) {
      const sheet = getSubsidy(phone.id, carrierId, storageSize, subscriptionType);
      if (sheet.출고가 > 0) return sheet.출고가;
    }
    const storage = phone.storage.find((s) => s.size === storageSize);
    return storage?.price ?? 0;
  };


  const setStep = useQuoteStore((s) => s.setStep);
  const currentStep = useQuoteStore((s) => s.currentStep);

  const handleSelectPhone = (phoneId: string) => {
    hapticMedium();
    setPhone(phoneId);
    // 바로 다음 단계로 이동
    setStep(currentStep + 1);
  };

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>원하시는 기기를 선택해주세요!</h2>

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
          {filteredPhones.map((phone) => {
            const isSelected = selectedPhoneId === phone.id;
            const lowestPrice = getDisplayPrice(phone, phone.storage[0].size);
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
              </div>
            );
          })}
        </div>
      </div>
      <StepNavigation canProceed={selectedPhoneId !== null} />
    </>
  );
}
