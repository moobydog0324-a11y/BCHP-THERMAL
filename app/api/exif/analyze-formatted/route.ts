import { NextRequest, NextResponse } from 'next/server'

const FLASK_SERVER = process.env.FLASK_SERVER_URL || 'http://localhost:5001'

/**
 * POST /api/exif/analyze-formatted
 * Flask 서버를 통해 이미지 메타데이터 분석 (사람이 읽기 편한 포맷)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 없습니다.' },
        { status: 400 }
      )
    }

    // Flask 서버로 전달
    const flaskFormData = new FormData()
    flaskFormData.append('file', file)

    const flaskResponse = await fetch(`${FLASK_SERVER}/analyze`, {
      method: 'POST',
      body: flaskFormData,
    })

    if (!flaskResponse.ok) {
      const error = await flaskResponse.json()
      return NextResponse.json(
        { success: false, error: error.error || 'Flask 서버 오류' },
        { status: flaskResponse.status }
      )
    }

    const result = await flaskResponse.json()

    if (!result.success) {
      return NextResponse.json(result)
    }

    const metadata = result.metadata
    const thermalData = result.thermal_data

    // 사람이 읽기 편한 구조로 재구성
    const formatted = {
      success: true,
      filename: result.filename,
      processing_time: result.processing_time,

      sections: {
        // 1. 가장 중요한 온도 정보
        temperature: {
          title: "🔥 실제 측정 온도",
          priority: 1,
          data: thermalData?.actual_temp_stats ? {
            min_temp: { label: "최저 온도", value: `${thermalData.actual_temp_stats.min_temp}°C`, unit: "°C", raw: thermalData.actual_temp_stats.min_temp },
            max_temp: { label: "최고 온도", value: `${thermalData.actual_temp_stats.max_temp}°C`, unit: "°C", raw: thermalData.actual_temp_stats.max_temp },
            avg_temp: { label: "평균 온도", value: `${thermalData.actual_temp_stats.avg_temp}°C`, unit: "°C", raw: thermalData.actual_temp_stats.avg_temp },
            median_temp: { label: "중앙값 온도", value: `${thermalData.actual_temp_stats.median_temp}°C`, unit: "°C", raw: thermalData.actual_temp_stats.median_temp },
            std_temp: { label: "표준편차", value: `${thermalData.actual_temp_stats.std_temp}°C`, unit: "°C", raw: thermalData.actual_temp_stats.std_temp },
            pixel_count: { label: "픽셀 수", value: thermalData.actual_temp_stats.pixel_count?.toLocaleString(), raw: thermalData.actual_temp_stats.pixel_count },
            camera_range: { label: "카메라 측정 범위", value: `${thermalData?.CameraTemperatureRangeMin || 'N/A'} ~ ${thermalData?.CameraTemperatureRangeMax || 'N/A'}` },
            note: "모든 보정(대기전송, 방사율, 반사 등)이 적용된 정확한 온도입니다."
          } : {
            warning: "실제 온도 데이터를 추출할 수 없습니다 (FLIR 포맷이 아닐 수 있음)",
            camera_range: { label: "카메라 측정 범위", value: `${thermalData?.CameraTemperatureRangeMin || 'N/A'} ~ ${thermalData?.CameraTemperatureRangeMax || 'N/A'}` }
          }
        },

        // 2. GPS 위치 정보
        gps: {
          title: "📍 GPS 위치",
          priority: 2,
          data: {
            position: { label: "좌표", value: metadata?.GPSPosition || "N/A" },
            latitude: { label: "위도", value: metadata?.GPSLatitude || "N/A" },
            longitude: { label: "경도", value: metadata?.GPSLongitude || "N/A" },
            altitude: { label: "절대 고도", value: metadata?.GPSAltitude || metadata?.AbsoluteAltitude ? `${metadata.AbsoluteAltitude} m` : "N/A" },
            relative_altitude: { label: "상대 고도 (드론)", value: metadata?.RelativeAltitude ? `${metadata.RelativeAltitude} m` : "N/A" },
            speed: { label: "속도", value: metadata?.GPSSpeed !== undefined ? `${metadata.GPSSpeed} km/h` : "N/A" },
            direction: { label: "방향", value: metadata?.GPSImgDirection !== undefined ? `${metadata.GPSImgDirection}°` : "N/A" }
          }
        },

        // 3. 기본 촬영 정보
        basic: {
          title: "📷 기본 정보",
          priority: 3,
          data: {
            make: { label: "제조사", value: metadata?.Make || "N/A" },
            model: { label: "카메라 모델", value: metadata?.Model || metadata?.CameraModel || "N/A" },
            serial_number: { label: "일련번호", value: metadata?.CameraSerialNumber || "N/A" },
            part_number: { label: "부품 번호", value: metadata?.CameraPartNumber || "N/A" },
            software: { label: "카메라 소프트웨어", value: metadata?.CameraSoftware || metadata?.Software || "N/A" },
            datetime: { label: "촬영 일시", value: metadata?.DateTimeOriginal || metadata?.CreateDate || "N/A" },
            image_size: { label: "이미지 크기", value: `${metadata?.ImageWidth || 0} × ${metadata?.ImageHeight || 0}` },
            file_size: { label: "파일 크기", value: metadata?.FileSize || "N/A" },
            orientation: { label: "방향", value: metadata?.Orientation || "N/A" }
          }
        },

        // 4. 카메라 촬영 설정
        camera_settings: {
          title: "📸 촬영 설정",
          priority: 4,
          data: {
            emissivity: { label: "방사율 (Emissivity)", value: thermalData?.Emissivity !== undefined ? thermalData.Emissivity : "N/A", description: "물체의 열 방출 능력 (0~1)" },
            iso: { label: "ISO", value: metadata?.ISO || "N/A" },
            shutter_speed: { label: "셔터 스피드", value: metadata?.ShutterSpeed || "N/A" },
            exposure_time: { label: "노출 시간", value: metadata?.ExposureTime || "N/A" },
            aperture: { label: "조리개", value: metadata?.FNumber ? `f/${metadata.FNumber}` : "N/A" },
            focal_length: { label: "초점 거리", value: metadata?.FocalLength || "N/A" },
            focal_length_35mm: { label: "35mm 환산", value: metadata?.FocalLength35efl || "N/A" },
            focus_distance: { label: "초점 거리", value: metadata?.FocusDistance || metadata?.ObjectDistance || "N/A" },
            fov: { label: "화각", value: metadata?.FOV || metadata?.FieldOfView || "N/A" },
            metering_mode: { label: "측광 모드", value: metadata?.MeteringMode || "N/A" },
            exposure_program: { label: "노출 프로그램", value: metadata?.ExposureProgram || "N/A" },
            exposure_compensation: { label: "노출 보정", value: metadata?.ExposureCompensation || "N/A" }
          }
        },

        // 5. 환경 보정 정보
        environment: {
          title: "🌡️ 환경 보정 설정",
          priority: 5,
          data: {
            atmospheric_temp: { label: "대기 온도", value: thermalData?.AtmosphericTemperature || "N/A" },
            reflected_temp: { label: "반사 온도", value: thermalData?.ReflectedApparentTemperature || "N/A" },
            humidity: { label: "상대 습도", value: thermalData?.RelativeHumidity || "N/A" },
            ir_window_temp: { label: "IR 윈도우 온도", value: thermalData?.IRWindowTemperature || "N/A" },
            ir_window_transmission: { label: "IR 윈도우 투과율", value: thermalData?.IRWindowTransmission || "N/A" },
            atmospheric_trans: {
              label: "대기 투과 계수",
              alpha1: thermalData?.AtmosphericTransAlpha1,
              alpha2: thermalData?.AtmosphericTransAlpha2,
              beta1: thermalData?.AtmosphericTransBeta1,
              beta2: thermalData?.AtmosphericTransBeta2,
              x: thermalData?.AtmosphericTransX
            }
          }
        },

        // 6. 드론 비행 정보
        drone: {
          title: "🚁 드론 비행 정보",
          priority: 6,
          data: {
            flight_pitch: { label: "비행 피치 (Pitch)", value: metadata?.FlightPitchDegree !== undefined ? `${metadata.FlightPitchDegree}°` : "N/A" },
            flight_roll: { label: "비행 롤 (Roll)", value: metadata?.FlightRollDegree !== undefined ? `${metadata.FlightRollDegree}°` : "N/A" },
            flight_yaw: { label: "비행 요 (Yaw)", value: metadata?.FlightYawDegree !== undefined ? `${metadata.FlightYawDegree}°` : "N/A" },
            gimbal_pitch: { label: "짐벌 피치", value: metadata?.GimbalPitchDegree !== undefined ? `${metadata.GimbalPitchDegree}°` : "N/A" },
            gimbal_roll: { label: "짐벌 롤", value: metadata?.GimbalRollDegree !== undefined ? `${metadata.GimbalRollDegree}°` : "N/A" },
            gimbal_yaw: { label: "짐벌 요", value: metadata?.GimbalYawDegree !== undefined ? `${metadata.GimbalYawDegree}°` : "N/A" },
            frame_rate: { label: "프레임 레이트", value: metadata?.FrameRate ? `${metadata.FrameRate} fps` : "N/A" }
          }
        },

        // 7. 렌즈 및 필터 정보
        lens: {
          title: "🔍 렌즈 및 필터",
          priority: 7,
          data: {
            lens_model: { label: "렌즈 모델", value: metadata?.LensModel || "N/A" },
            lens_serial: { label: "렌즈 일련번호", value: metadata?.LensSerialNumber || "N/A" },
            filter_model: { label: "필터 모델", value: metadata?.FilterModel || "N/A" },
            peak_sensitivity: { label: "피크 분광 감도", value: metadata?.PeakSpectralSensitivity || "N/A" }
          }
        },

        // 8. Planck 보정 상수
        planck: {
          title: "🔬 Planck 상수 (열화상 보정)",
          priority: 8,
          collapsed: true,
          data: {
            planck_r1: { label: "PlanckR1", value: thermalData?.PlanckR1 || "N/A" },
            planck_r2: { label: "PlanckR2", value: thermalData?.PlanckR2 || "N/A" },
            planck_b: { label: "PlanckB", value: thermalData?.PlanckB || "N/A" },
            planck_f: { label: "PlanckF", value: thermalData?.PlanckF || "N/A" },
            planck_o: { label: "PlanckO", value: thermalData?.PlanckO || "N/A" },
            note: "온도 계산을 위한 카메라 고유의 보정 상수"
          }
        },

        // 9. Raw 열화상 데이터
        raw_thermal: {
          title: "📊 Raw 열화상 데이터",
          priority: 9,
          collapsed: true,
          data: {
            raw_size: { label: "Raw 이미지 크기", value: `${metadata?.RawThermalImageWidth || 0} × ${metadata?.RawThermalImageHeight || 0}` },
            raw_type: { label: "Raw 이미지 타입", value: metadata?.RawThermalImageType || "N/A" },
            raw_median: { label: "Raw 값 중앙값", value: metadata?.RawValueMedian || "N/A" },
            raw_range: { label: "Raw 값 범위", value: metadata?.RawValueRange || "N/A" },
            raw_min: { label: "Raw 값 최소", value: metadata?.RawValueRangeMin || "N/A" },
            raw_max: { label: "Raw 값 최대", value: metadata?.RawValueRangeMax || "N/A" }
          }
        },

        // 10. 기술적 세부사항
        technical: {
          title: "⚙️ 기술적 세부사항",
          priority: 10,
          collapsed: true,
          data: {
            color_space: { label: "색 공간", value: metadata?.ColorSpace || "N/A" },
            compression: { label: "압축 방식", value: metadata?.Compression || "N/A" },
            encoding: { label: "인코딩", value: metadata?.EncodingProcess || "N/A" },
            bits_per_sample: { label: "샘플당 비트", value: metadata?.BitsPerSample || "N/A" },
            color_components: { label: "색상 구성요소", value: metadata?.ColorComponents || "N/A" },
            resolution_unit: { label: "해상도 단위", value: metadata?.ResolutionUnit || "N/A" },
            x_resolution: { label: "X 해상도", value: metadata?.XResolution || "N/A" },
            y_resolution: { label: "Y 해상도", value: metadata?.YResolution || "N/A" },
            exiftool_version: { label: "ExifTool 버전", value: metadata?.ExifToolVersion || "N/A" }
          }
        }
      },

      // 경고 메시지
      warnings: metadata?.Warning ? [metadata.Warning] : [],

      // 원본 데이터 참조
      has_raw_data: true
    }

    // 원본 데이터도 함께 반환 (필요시 접어서 볼 수 있도록)
    return NextResponse.json({
      ...formatted,
      _raw_metadata: metadata,
      _raw_thermal_data: thermalData,
    })

  } catch (error) {
    console.error('ExifTool 분석 오류:', error)

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Flask 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.',
          flask_url: FLASK_SERVER,
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}

