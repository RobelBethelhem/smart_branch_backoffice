import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion'; // Add this import
import {
  CCard,
  CCardBody,
  CForm,
  CContainer,
 
} from '@coreui/react';
import '@coreui/coreui/dist/css/coreui.min.css';
import logoImage from './logo.png';
import watermarkImage from './watermark.png';
import stampImage from './stamp.png';
import boolImage from './bool.png';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeWithLogo from './QRCodeWithLogo';
import './spaced.css';
import AutoResizeInput  from "./AutoResizeInput "
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useLocation } from 'react-router-dom';
import Confetti from 'react-confetti'; 

const FlexContainer = ({ children, style }) => (
  <div className="d-flex flex-wrap align-items-baseline mb-2" style={style}>
    {children}
  </div>
);

const InlineInput = ({ prefix, suffix, placeholder, onChange, style }) => (
  <div className="d-inline-flex align-items-baseline" style={{ maxWidth: '100%', position: 'relative' }}>
    {prefix && <span style={{ marginRight: '2px' }}>{prefix}</span>}
    <AutoResizeInput placeholder={placeholder} onChange={onChange} style={style} />
    {suffix && <span style={{ marginLeft: '2px' }}>{suffix}</span>}
  </div>
);

const FlexItem = ({ children, style }) => (
  <div className="d-flex align-items-baseline flex-wrap" style={{ marginRight: '10px', ...style }}>
    {children}
  </div>
);

const SocialIcon = ({ path, viewBox = "0 0 24 24" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} width="18" height="18" fill="currentColor">
    <path d={path} />
  </svg>
);

// Function to convert numbers to words
const numberToWords = (num) => {
  const ones = ['', 'አንድ', 'ሁለት', 'ሶስት', 'አራት', 'አምስት', 'ስድስት', 'ሰባት', 'ስምንት', 'ዘጠኝ'];
  const tens = ['', '', 'ሃያ', 'ሰላሳ', 'አርባ', 'ሃምሳ', 'ስልሳ', 'ሰባ', 'ሰማንያ', 'ዘጠና'];
  const teens = ['አስር', 'አስራ አንድ', 'አስራ ሁለት', 'አስራ ሶስት', 'አስራ አራት', 'አስራ አምስት', 'አስራ ስድስት', 'አስራ ሰባት', 'አስራ ስምንት', 'አስራ ዘጠኝ'];

  if (num === 0 || (typeof num === 'string' && num.startsWith('0'))) return 'ዜሮ';

  const convertLessThanThousand = (n) => {
    if (n >= 100) {
      return ones[Math.floor(n / 100)] + ' መቶ ' + convertLessThanThousand(n % 100);
    }
    if (n >= 20) {
      return tens[Math.floor(n / 10)] + ' ' + ones[n % 10];
    }
    if (n >= 10) {
      return teens[n - 10];
    }
    return ones[n];
  };

  const convert = (n) => {
    if (n >= 1000000000) {
      return convert(Math.floor(n / 1000000000)) + ' ቢሊዮን ' + convert(n % 1000000000);
    }
    if (n >= 1000000) {
      return convert(Math.floor(n / 1000000)) + ' ሚሊዮን ' + convert(n % 1000000);
    }
    if (n >= 1000) {
      return convert(Math.floor(n / 1000)) + ' ሺ ' + convert(n % 1000);
    }
    return convertLessThanThousand(n);
  };

  return convert(num).trim();
};

const Guarenty_Letter = () => {
  const location = useLocation();
  const rowData = location.state?.rowData;

  if (!rowData) {
    return <div>No data available</div>;
  }

  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });




  var employee_first_name = rowData.employee_first_name;
  var employee_last_name = rowData.employee_last_name;
  var employee_middle_name = rowData.employee_middle_name;

  var guarenty_first_name = rowData.guaranty_first_name;
  var guarenty_last_name = rowData.guaranty_last_name;
  var guarenty_middle_name = rowData.guaranty_middle_name;

  var full_guarenty_name = guarenty_first_name + ' ' + guarenty_middle_name + ' ' + guarenty_last_name;

  var full_name = employee_first_name + ' ' + employee_middle_name + ' ' + employee_last_name;
  var request_day_amharic = rowData.request_day_amharic;
  var approved_day_amharic = rowData.approved_day_amharic;
  var salary = rowData.salary;

  var salary_in_words = numberToWords(salary);
  var guaranty_organazation = rowData.guaranty_organazation;
  var employee_organization_location = rowData.employee_organization_location;




  const [numberInput, setNumberInput] = useState(21);
  const [wordOutput, setWordOutput] = useState('');
  useEffect(() => {
    const result = numberToWords(numberInput);
    setWordOutput(result);
    console.log(`Number ${numberInput} in words: ${result}`);
  }, [numberInput]);


   // Add window resize handler
   useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Modify the existing useEffect
  useEffect(() => {
    setIsLoaded(true);
    // Add timer to show confetti after rotation animation
    const timer = setTimeout(() => {
      setShowConfetti(true);
    }, 3000); // 3 seconds matches the rotation duration

    return () => clearTimeout(timer);
  }, []);




  const data = "https://www.zemenbank.com";
  const size = 100;
  const qrSize = size;
  const logoSize = size * 0.18;

  const printRef = React.useRef();

  const handlePrint = () => {
    const content = printRef.current;
    
    html2canvas(content, { 
      scale: 2,
      useCORS: true,
      allowTaint: true,
      scrollY: -window.scrollY
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      
      const printWindow = window.open('', '_blank');
      const aspectRatio = canvas.height / canvas.width;
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print</title>
            <style>
              @page {
                size: letter;
                margin: 0;
              }
              body { 
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: start;
                width: 8.5in;
                height: 11in;
              }
              img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
              @media print {
                body { 
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            </style>
          </head>
          <body>
            <img src="${imgData}" alt="Print content">
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    });
  };

  const handleDownload = () => {
    const input = printRef.current;
    html2canvas(input, { 
      scale: 2,
      useCORS: true,
      allowTaint: true,
      scrollY: -window.scrollY
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4', // Updated from 'letter' to 'a4'
        compress: true
      });
  
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = 0;
      const imgY = 0;
  
      pdf.addImage(imgData, 'PNG', imgX, imgY, pdfWidth, imgHeight * (pdfWidth / imgWidth));
      pdf.save('supportive.pdf');
    });
  };

  // const experienceData = [
  //   "From October 30, 2013 to June 30, 2017 as a Teller.",
  //   "From July 1, 2017 to December 31, 2018 as a Customer Service Officer II.",
  //   "From January 1, 2019 to September 14, 2020 as a Senior Customer Service Officer – Cash.",
  //   "From September 15, 2020 to March 15, 2022 as a Senior Customer Service Officer- Operation.",
  //   "From March 16, 2022 to December 31, 2022 as a Head, ATM and POS Management Section.",
  //   "From January 01, 2023 to February 03, 2023 as a Head, Dispute Management Section.",
  //   "From February 04, 2023 to July 09, 2023 as an Acting Manager, Dispute Management and Recounsilation Division.",
  //   "From July 10, 2023 to date as a Manager, Payroll, ATM Services & Doorstep Banking Division."
  // ];

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const cardVariants = {
    hidden: { opacity: 0, rotate: 360 },
    visible: { 
      opacity: 1, 
      rotate: 0,
      transition: { 
        duration: 3,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      {showConfetti && (
        <Confetti
          width={windowDimensions.width}
          height={windowDimensions.height}
          recycle={true}
          numberOfPieces={500}
          gravity={0.3}
          tweenDuration={5000}
          colors={['#ff6b6b', '#4ecdc4', '#fff176', '#64b5f6', '#ba68c8']}
        />
      )}
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="position-relative" style={{ width: '210mm', maxWidth: '100%' }}>
        <div className="top-0 start-0 m-3 z-index-1">
          <button onClick={handlePrint} className="btn btn-primary me-2">Print</button>
          <button onClick={handleDownload} className="btn btn-success">Download as PDF</button>
        </div>
        <motion.div
          initial="hidden"
          animate={isLoaded ? "visible" : "hidden"}
          variants={cardVariants}
        >
          <CCard className="shadow-sm" style={{
            width: '210mm',
            height: '297mm',
            maxWidth: '100%',
            position: 'relative',
            overflow: 'hidden'
          }} ref={printRef}> 
            <div style={{
              position: 'absolute',
              top: '30px',
              left: '30px',
              bottom: '30px',
              width: '4px',
              backgroundColor: 'red'
            }}></div>
            
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url(${watermarkImage})`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: '170%',
              opacity: 0.1,
              pointerEvents: 'none',
            }}></div>

            <img
              src={logoImage}
              alt="Logo"
              style={{
                position: 'absolute',
                top: '60px',
                left: '50px',
                width: '180px',
                height: 'auto'
              }}
            />
            
            <CCardBody className="ps-5 pe-4 mt-5">
              <CForm>
                <CContainer fluid className="p-0" style={{ height: '100%', fontFamily: 'Calibri, sans-serif' }}>
                  
                  {/* Date and Reference Number */}
                  <div className="d-flex flex-column align-items-end mb-4">
                    <div className="d-flex justify-content-end w-100 mb-2">
                      <div className="d-flex align-items-center">
                        <span className="me-2 text-nowrap">ቀን:</span>
                       {approved_day_amharic}
                      </div>
                    </div>
                    <div className="d-flex justify-content-end w-100">
                      <div className="d-flex align-items-center">
                        <span className="me-2 text-nowrap">ቁጥር:</span>
                        <input 
                          className="form-control-plaintext" 
                          style={{width: '200px', outline: 'none'}} 
                          type="text" 
                        />
                      </div>
                    </div>
                  </div>


                  <div className="d-flex flex-column  mb-4">
                  <div className="d-flex  w-100 mb-2">
                    <div className="d-flex align-items-center">
                      <span className="me-2 text-nowrap">ለ </span>
                      {guaranty_organazation}
                    </div>
                  </div>
                  <div className="d-flex  w-100">
                    <div className="d-flex align-items-center">
                      <span className="me-2 text-nowrap"></span>
                     {employee_organization_location}
                    </div>
                  </div>
                </div>



                  {/* Certificate Header */}
                  <div className="text-center fw-bold mb-4 text-decoration-underline">
                     ጉዳዩ:- መረጃ መስጠትን ይመለከታል፡፡
                  </div>

                  {/* Certification Body */}
                  <FlexContainer>
                    <FlexItem>
                      <span className="spaced">የባንካችን</span>
                      <span className="spaced">ሠራተኛ</span>
                      <span className="spaced">የሆኑት</span>
                      <span className="spaced">አቶ/ወይ</span>
                      {full_name}
                      <span className="spaced spaced_left">ለአቶ/ወይ</span>
                      {full_guarenty_name}
                      <span className="spaced spaced_left">ዋስ</span>
                      <span className="spaced">መሆን</span>
                      <span className="spaced">ይችሉ</span>
                      <span className="spaced">ዘንድ</span>
                      <span className="spaced">የደመወዛቸው</span>
                      <span className="spaced">መጠንና</span>
                      <span className="spaced">ቋሚ</span>
                      <span className="spaced">ሠራተኛ</span>
                      <span className="spaced">መሆናቸው</span>
                      <span className="spaced">ተገልጾ</span>
                      <span className="spaced">ለተቋሙ</span>
                      <span className="spaced">መረጃ</span>
                      <span className="spaced">እንዲሰጣቸው</span>
                     {request_day_amharic}
                      
                      <span className="spaced spaced_left">በተፃፈ</span>
                      <span className="spaced">ማመልከቻ</span>
                      <span className="spaced">ጠይቀዋል</span>
                      <span className="spaced">፡፡</span>
                    </FlexItem>
                  </FlexContainer>

                  {/* Currently Working Details */}
                  <FlexContainer>
                    <FlexItem>
                      <span className="spaced">ስለሆነም</span>
                      <span className="spaced">ለአቶ/ወይ</span>
                      {full_name}
                      <span className="spaced spaced_left">የባንክን</span>
                      <span className="spaced">ቋሚ</span>
                      <span className="spaced">ሠራተኛና</span>
                      <span className="spaced">በወር</span>
                      <span className="spaced">ያልተጣራ</span>
                      <span className="spaced">ደመወዝ</span>
                      <span className="spaced">ብር</span>
                      {Number(salary).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      <span className="spaced">/</span>
                     {salary_in_words}
                      <span className="spaced">/</span>
                      <span className="spaced">የሚከፈላቸው</span>
                      <span className="spaced">መሆኑን</span>
                      <span className="spaced">እየገለጽን፤</span>
                      <span className="spaced">ሠራተኛው/ዋ</span>
                      <span className="spaced">ከባንካችን</span>
                      <span className="spaced">ጋር</span>
                      <span className="spaced">ያላቸው</span>
                      <span className="spaced">የሥራ</span>
                      <span className="spaced">ውል</span>
                      <span className="spaced">ሲቋረጥ</span>
                      <span className="spaced">የምናሳውቅ</span>
                      <span className="spaced">መሆኑን</span>
                      <span className="spaced">እንገልጻለን</span>
                      <span className="spaced">፡፡</span>
                    </FlexItem>
                  </FlexContainer>

                  {/* Sincerely and Signature */}
                  <div className="mt-4 mb-5">
                  ከሰላምታ ጋር
                  </div>

                  {/* Signature and Stamp Image */}
                  <FlexContainer style={{ alignItems: 'flex-start', marginTop: '10px' }}>
                    <div className="fst-italic">
                    ኑሩ ሙስጠፋ
                      <br />
                      ዳይሬክተር- የስራ አፈፃፀም እና የሰራተኞች አገልግሎት መምሪያ
                    </div>
                    {/* Stamp Image Positioned Next to the Signature */}
                    <img
                      src={stampImage}
                      alt="Stamp"
                      style={{
                        position: 'absolute',
                        marginLeft: '120px', // Space between text and image
                        width: '150px',      // Adjust as needed
                        height: 'auto',
                        alignSelf: 'flex-start', // Aligns the image to the top of the container
                        marginTop: '-80px' 
                      }}
                    />
                  </FlexContainer>

                  {/* QR Code and Social Icons */}
                  <div 
                    className="fst-italic mt-3 position-absolute bottom-0 start-0" 
                    style={{ paddingLeft: '50px', marginBottom: '30px' }}
                  >
                    <div style={{ position: 'relative', width: qrSize, height: qrSize }}>
                      <QRCodeWithLogo 
                        url="https://www.zemenbank.com"
                        size={80}
                        logoUrl={watermarkImage}
                      />
                    </div>
                    <br />
                    <small style={{ fontWeight: 'bold', lineHeight: '0' }}>
                      ዘመን ባንክ አ.ማ. / Zemen bank S.C.
                      <br />
                      Ras Abebe Aregay St.
                      <br />
                      P.O.Box 1212 Addis Ababa, Ethiopia
                      <br />
                      SWIFT Code: ZEMEETAA
                      <br />
                      Call Center 6500
                      <br />
                      info@zemenbank.com
                      <br />
                      <span style={{ color: 'red', fontWeight: 'bold' }}>www.zemenbank.com</span>
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ backgroundColor: 'red', color: 'white', padding: '4px', borderRadius: '50%' }}>
                            <SocialIcon path="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                          </div>
                          <div style={{ backgroundColor: 'red', color: 'white', padding: '4px', borderRadius: '50%' }}>
                            <SocialIcon path="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
                          </div>
                          <div style={{ backgroundColor: 'red', color: 'white', padding: '4px', borderRadius: '50%' }}>
                            <SocialIcon path="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z M2 9h4v12H2z M4 2a2 2 0 1 1-2 2 2 2 0 0 1 2-2z" />
                          </div>
                          <div style={{ backgroundColor: 'red', color: 'white', padding: '4px', borderRadius: '50%' }}>
                            <SocialIcon path="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                          </div>

                          <span style={{ color: 'red', fontWeight: 'bold', marginLeft: '60px' }}>
                            DRIVING THE FUTURE FINANCIAL SERVICES EXPERIENCE
                          </span>
                        </div>
                      </div>
                    </small>
                  </div>
               
                  {/* Bottom Image */}
                  <img
                    src={boolImage}
                    alt="Bool"
                    style={{
                      position: 'absolute',
                      bottom: '20px',
                      right: '1px',
                      width: '150px',
                      height: 'auto'
                    }}
                  />
                </CContainer>
              </CForm>
            </CCardBody>
          </CCard>
        </motion.div>
      </div>
    </div>
    </div>
  );
};

export default Guarenty_Letter;
