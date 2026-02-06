/**
 * 온도 경고 레벨 유닛 테스트
 */

describe('온도 경고 레벨 테스트', () => {
  // getTempWarningLevel 함수 구현 (예시)
  const getTempWarningLevel = (maxTemp: string | null) => {
    if (!maxTemp) return null
    const temp = parseFloat(maxTemp.replace('°C', '').trim())
    
    if (temp < 40) {
      return { level: 'normal', label: '정상', color: 'text-green-600' }
    } else if (temp >= 40 && temp < 60) {
      return { level: 'observation', label: '관찰', color: 'text-yellow-600' }
    } else if (temp >= 60 && temp < 70) {
      return { level: 'caution', label: '주의', color: 'text-orange-600' }
    } else {
      return { level: 'warning', label: '경고', color: 'text-red-600' }
    }
  }

  describe('정상 온도 (< 40°C)', () => {
    test('20°C는 정상', () => {
      const result = getTempWarningLevel('20.0°C')
      expect(result?.level).toBe('normal')
      expect(result?.label).toBe('정상')
    })

    test('39.9°C는 정상', () => {
      const result = getTempWarningLevel('39.9°C')
      expect(result?.level).toBe('normal')
    })

    test('0°C는 정상', () => {
      const result = getTempWarningLevel('0.0°C')
      expect(result?.level).toBe('normal')
    })
  })

  describe('관찰 온도 (40-60°C)', () => {
    test('40.0°C는 관찰', () => {
      const result = getTempWarningLevel('40.0°C')
      expect(result?.level).toBe('observation')
      expect(result?.label).toBe('관찰')
    })

    test('50.0°C는 관찰', () => {
      const result = getTempWarningLevel('50.0°C')
      expect(result?.level).toBe('observation')
    })

    test('59.9°C는 관찰', () => {
      const result = getTempWarningLevel('59.9°C')
      expect(result?.level).toBe('observation')
    })
  })

  describe('주의 온도 (60-70°C)', () => {
    test('60.0°C는 주의', () => {
      const result = getTempWarningLevel('60.0°C')
      expect(result?.level).toBe('caution')
      expect(result?.label).toBe('주의')
    })

    test('65.0°C는 주의', () => {
      const result = getTempWarningLevel('65.0°C')
      expect(result?.level).toBe('caution')
    })

    test('69.9°C는 주의', () => {
      const result = getTempWarningLevel('69.9°C')
      expect(result?.level).toBe('caution')
    })
  })

  describe('경고 온도 (≥ 70°C)', () => {
    test('70.0°C는 경고', () => {
      const result = getTempWarningLevel('70.0°C')
      expect(result?.level).toBe('warning')
      expect(result?.label).toBe('경고')
    })

    test('100.0°C는 경고', () => {
      const result = getTempWarningLevel('100.0°C')
      expect(result?.level).toBe('warning')
    })
  })

  describe('엣지 케이스', () => {
    test('null 입력은 null 반환', () => {
      const result = getTempWarningLevel(null)
      expect(result).toBeNull()
    })

    test('빈 문자열은 null 반환', () => {
      const result = getTempWarningLevel('')
      expect(result).toBeNull()
    })

    test('°C 없는 숫자 문자열도 처리', () => {
      const result = getTempWarningLevel('45.5')
      expect(result?.level).toBe('observation')
    })

    test('공백이 있는 문자열 처리', () => {
      const result = getTempWarningLevel(' 35.5 °C ')
      expect(result?.level).toBe('normal')
    })
  })

  describe('경계값 테스트', () => {
    test('정확히 40°C', () => {
      const result = getTempWarningLevel('40.0°C')
      expect(result?.level).toBe('observation')
    })

    test('정확히 60°C', () => {
      const result = getTempWarningLevel('60.0°C')
      expect(result?.level).toBe('caution')
    })

    test('정확히 70°C', () => {
      const result = getTempWarningLevel('70.0°C')
      expect(result?.level).toBe('warning')
    })
  })
})

describe('파일명으로 이미지 타입 감지 테스트', () => {
  // detectImageTypeByFilename 함수 구현 (예시)
  const detectImageTypeByFilename = (fileName: string): 'thermal' | 'real' => {
    const lowerName = fileName.toLowerCase()
    
    // 파일명R.jpg → 열화상
    if (/r\.(jpg|jpeg|png|tiff|tif)$/i.test(lowerName)) {
      return 'thermal'
    }
    
    // 열화상 키워드
    if (lowerName.includes('ir_') || lowerName.includes('flir') || lowerName.includes('thermal')) {
      return 'thermal'
    }
    
    // 기본값은 실화상
    return 'real'
  }

  describe('DJI 카메라 파일명 패턴', () => {
    test('DJI_0001R.jpg는 열화상', () => {
      expect(detectImageTypeByFilename('DJI_0001R.jpg')).toBe('thermal')
    })

    test('DJI_0001.jpg는 실화상', () => {
      expect(detectImageTypeByFilename('DJI_0001.jpg')).toBe('real')
    })

    test('DJI_0123R.JPG (대문자)는 열화상', () => {
      expect(detectImageTypeByFilename('DJI_0123R.JPG')).toBe('thermal')
    })
  })

  describe('FLIR 카메라 파일명 패턴', () => {
    test('FLIR1234.jpg는 열화상', () => {
      expect(detectImageTypeByFilename('FLIR1234.jpg')).toBe('thermal')
    })

    test('IR_001.jpg는 열화상', () => {
      expect(detectImageTypeByFilename('IR_001.jpg')).toBe('thermal')
    })

    test('thermal_image.jpg는 열화상', () => {
      expect(detectImageTypeByFilename('thermal_image.jpg')).toBe('thermal')
    })
  })

  describe('일반 파일명', () => {
    test('photo.jpg는 실화상', () => {
      expect(detectImageTypeByFilename('photo.jpg')).toBe('real')
    })

    test('IMG_1234.jpg는 실화상', () => {
      expect(detectImageTypeByFilename('IMG_1234.jpg')).toBe('real')
    })
  })

  describe('다양한 확장자', () => {
    test('.png 확장자 지원', () => {
      expect(detectImageTypeByFilename('DJI_0001R.png')).toBe('thermal')
    })

    test('.tiff 확장자 지원', () => {
      expect(detectImageTypeByFilename('IR_001.tiff')).toBe('thermal')
    })
  })
})



