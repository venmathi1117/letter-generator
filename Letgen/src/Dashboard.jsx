import React, { useState, useEffect, useRef } from 'react';
import 'bulma/css/bulma.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './custom.css';
import jsPDF from 'jspdf';
import { PDFDocument, rgb } from 'pdf-lib';
import { Toaster, toast } from 'react-hot-toast';

const Dashboard = () => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [view, setView] = useState('letterGenerator');
  const [profileDetails, setProfileDetails] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfileDetails, setTempProfileDetails] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorProfile, setErrorProfile] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [formData, setFormData] = useState({
    recipientId: '',
    letterType: 'leave',
    startDate: '',
    endDate: '',
    reason: '',
    companyName: '',
    companyLocation: '',
    collegeName: '',
    collegeLocation: '',
    date: '',
    numberOfStudents: '',
    location: '',
  });
  const [letterHistory, setLetterHistory] = useState([]);
  const [digitalSignature, setDigitalSignature] = useState(null);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isEditingLetter, setIsEditingLetter] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [generatedLetterData, setGeneratedLetterData] = useState(null);
  const [currentLetterFile, setCurrentLetterFile] = useState(null);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [emails, setEmails] = useState([]);
  const [emailForm, setEmailForm] = useState({
    from: '',
    to: '',
    subject: '',
    message: '',
    file: null,
  });
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const collegeMailId = localStorage.getItem('userCollegeId');
  const navigate = useNavigate();

  // RSA Key Generation
  const generateRSAKeyPair = async () => {
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-PSS',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
      );
      const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
      return {
        publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
        privateKey: keyPair.privateKey,
      };
    } catch (error) {
      console.error('Error generating RSA key pair:', error);
      toast.error('Failed to generate RSA key pair');
      throw error;
    }
  };

  // Sign PDF
  const signPDF = async (file, privateKey) => {
    try {
      const pdfBytes = await file.arrayBuffer();
      const hash = await window.crypto.subtle.digest('SHA-256', pdfBytes);
      const signature = await window.crypto.subtle.sign(
        { name: 'RSA-PSS', saltLength: 32 },
        privateKey,
        hash
      );
      return btoa(String.fromCharCode(...new Uint8Array(signature)));
    } catch (error) {
      console.error('Error signing PDF:', error);
      toast.error('Failed to sign PDF');
      throw error;
    }
  };

  // Verify Signature
  const verifySignature = async (file, signature, publicKey) => {
    try {
      const pdfBytes = await file.arrayBuffer();
      const hash = await window.crypto.subtle.digest('SHA-256', pdfBytes);
      const publicKeyImported = await window.crypto.subtle.importKey(
        'spki',
        Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0)),
        { name: 'RSA-PSS', hash: 'SHA-256' },
        false,
        ['verify']
      );
      const signatureBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
      return await window.crypto.subtle.verify(
        { name: 'RSA-PSS', saltLength: 32 },
        publicKeyImported,
        signatureBytes,
        hash
      );
    } catch (error) {
      console.error('Error verifying signature:', error);
      toast.error('Failed to verify signature');
      return false;
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`http://localhost:3008/users/email/${collegeMailId}`);
      setProfileDetails(response.data);
      setTempProfileDetails({ ...response.data });
      setEmailForm((prev) => ({ ...prev, from: response.data.collegeMailId }));
      localStorage.setItem('userId', response.data._id);
      // Set default view to 'gmail' for staff
      if (!response.data.professionRole.includes('student')) {
        setView('gmail');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setErrorProfile('Failed to load profile information.');
      toast.error('Failed to load profile.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchRecipients = async () => {
    try {
      const response = await axios.get('http://localhost:3008/users', {
        params: { excludeRole: profileDetails?.professionRole.includes('student') ? 'student' : '' },
      });
      setRecipients(response.data);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      toast.error('Failed to load recipients.');
    }
  };

  const fetchLetterHistory = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      toast.error('User ID not found.');
      return;
    }
    try {
      const response = await axios.get(`http://localhost:3008/letters/${userId}`);
      setLetterHistory(response.data);
      console.log('Fetched Letter History:', response.data);
    } catch (error) {
      console.error('Error fetching letter history:', error);
      toast.error('Failed to load letter history.');
    }
  };

  const fetchEmails = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      toast.error('User ID not found.');
      navigate('/login');
      return;
    }
    setEmailLoading(true);
    try {
      const response = await axios.get(`http://localhost:3008/emails/${userId}`);
      setEmails(response.data);
      if (response.data.length > 0) {
        toast.success('Emails fetched!');
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      setEmailError('Failed to fetch emails.');
      toast.error('Failed to fetch emails.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleViewChange = (newView) => {
    // Prevent staff from accessing letterGenerator
    if (isStaff && newView === 'letterGenerator') {
      toast.error('Letter Generator is only available for students.');
      return;
    }
    setView(newView);
    setIsEditingProfile(newView === 'profileEdit');
    setIsEditingLetter(false);
    setIsUserMenuOpen(false);
    if (newView === 'gmail') {
      fetchEmails();
    } else if (newView === 'yourLetters') {
      fetchLetterHistory();
    }
  };

  const handleEditProfile = () => {
    setIsEditingProfile(true);
    setTempProfileDetails({ ...profileDetails });
    setView('profileEdit');
  };

  const handleProfileInputChange = (e) => {
    const { name, value } = e.target;
    setTempProfileDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        setErrorProfile('User ID not found. Please log in again.');
        toast.error('User ID not found.');
        return;
      }
      const response = await axios.put(`http://localhost:3008/users/${userId}`, tempProfileDetails);
      setProfileDetails(response.data);
      setTempProfileDetails(response.data);
      setEmailForm((prev) => ({ ...prev, from: response.data.collegeMailId }));
      setIsEditingProfile(false);
      setView('profileView');
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setTempProfileDetails({ ...profileDetails });
    setView('profileView');
  };

  const handleUserMenuToggle = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEmailFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'file') {
      setEmailForm((prev) => ({ ...prev, file: files[0] }));
    } else {
      setEmailForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.to || !emailForm.subject || !emailForm.message) {
      setEmailError('All fields are required.');
      toast.error('All fields are required.');
      return;
    }
    if (emailForm.file && emailForm.file.type !== 'application/pdf') {
      setEmailError('Only PDF files are allowed.');
      toast.error('Only PDF files are allowed.');
      return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
      setEmailError('User ID not found.');
      toast.error('User ID not found.');
      setEmailLoading(false);
      return;
    }

    // For staff with an attached file, open signature canvas
    if (isStaff && emailForm.file) {
      setCurrentLetterFile(emailForm.file);
      setIsCanvasOpen(true);
      return;
    }

    // Proceed with saving email if no signature required
    await sendEmail(null);
  };

  const sendEmail = async (signatureData) => {
    setEmailError('');
    setEmailLoading(true);

    const userId = localStorage.getItem('userId');
    const formData = new FormData();
    formData.append('from', emailForm.from);
    formData.append('to', emailForm.to);
    formData.append('subject', emailForm.subject);
    formData.append('message', emailForm.message);
    formData.append('userId', userId);

    if (emailForm.file) {
      if (signatureData && isStaff) {
        // Generate signed PDF first
        const signedPdfBlob = await generateSignedPDF(emailForm.file, signatureData);
        // Generate RSA key pair and sign the modified PDF
        const { publicKey, privateKey } = await generateRSAKeyPair();
        const digitalSignature = await signPDF(signedPdfBlob, privateKey);
        console.log('RSA Data:', { publicKey, digitalSignature });
        formData.append('file', signedPdfBlob, emailForm.file.name);
        formData.append('digitalSignature', digitalSignature);
        formData.append('publicKey', publicKey);
      } else {
        formData.append('file', emailForm.file);
      }
    }

    try {
      const response = await axios.post('http://localhost:3008/send-email', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Email saved successfully!');
      setEmailForm({ from: profileDetails?.collegeMailId || '', to: '', subject: '', message: '', file: null });
      setCurrentLetterFile(null);
      setDigitalSignature(null);
      setIsCanvasOpen(false);
      fetchEmails();
      return response.data.email;
    } catch (error) {
      console.error('Error saving email:', error);
      setEmailError('Failed to save email.');
      toast.error('Failed to save email.');
      return null;
    } finally {
      setEmailLoading(false);
    }
  };

  const generateSignedPDF = async (file, signatureData) => {
    try {
      // Read the original PDF
      const pdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Get the last page
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width, height } = lastPage.getSize();

      // Embed the signature image
      if (signatureData && signatureData.image) {
        // Convert base64 signature to bytes
        const signatureImageBytes = Uint8Array.from(atob(signatureData.image.split(',')[1]), (c) => c.charCodeAt(0));
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

        // Add signature to the bottom-left of the last page
        lastPage.drawImage(signatureImage, {
          x: 50,
          y: 50,
          width: 100,
          height: 40,
        });

        // Add signature text
        const signatureText = `Signed by ${signatureData.signedBy} on ${new Date(signatureData.signedAt).toLocaleString()}`;
        lastPage.drawText(signatureText, {
          x: 50,
          y: 30,
          size: 10,
          color: rgb(0, 0, 0),
        });
      }

      // Save the modified PDF
      const pdfBytesModified = await pdfDoc.save();
      return new Blob([pdfBytesModified], { type: 'application/pdf' });
    } catch (error) {
      console.error('Error generating signed PDF:', error);
      toast.error('Failed to generate signed PDF');
      throw error;
    }
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    const signatureData = {
      image: canvas.toDataURL('image/png'),
      signedBy: profileDetails.name,
      signedById: localStorage.getItem('userId'),
      signedAt: new Date().toISOString(),
    };
    setDigitalSignature(signatureData);
    setIsCanvasOpen(false);

    // Proceed with saving email with the signature
    await sendEmail(signatureData);
  };

  const handleEmailClick = (email) => {
    setSelectedEmail(email);
  };

  const handleCloseEmail = () => {
    setSelectedEmail(null);
  };

  const handleDownloadAttachment = async (email) => {
    if (!email.pdfAttachment || !email.pdfName) {
      toast.error('No attachment found.');
      return;
    }

    try {
      const byteCharacters = atob(email.pdfAttachment);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Verify digital signature if present
      if (email.digitalSignature && email.publicKey) {
        console.log('Verifying Email:', { emailId: email._id, pdfName: email.pdfName });
        const isValid = await verifySignature(blob, email.digitalSignature, email.publicKey);
        console.log(`Signature Verification: ${isValid ? 'Valid' : 'Invalid'}`);
        toast.success(`Signature: ${isValid ? 'Valid' : 'Invalid'}`);
      } else {
        console.log('No digital signature available for verification');
        toast.info('No digital signature to verify');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = email.pdfName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Attachment downloaded!');
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast.error('Failed to download attachment');
    }
  };

  useEffect(() => {
    if (isCanvasOpen) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'black';
    }
  }, [isCanvasOpen]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const generateLetterContent = (letterData) => {
    const { recipientId, letterType, startDate, endDate, reason, companyName, companyLocation, collegeName, collegeLocation, date, numberOfStudents, location } = letterData;
    const recipient = recipients.find((r) => r._id === recipientId);
    const letterDate = new Date(letterData.createdAt || new Date()).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).split('/').join('-');

    const senderRole = profileDetails?.professionRole.includes('student')
      ? `Roll Number: ${profileDetails?.rollNumber}`
      : `Role: ${profileDetails?.professionRole.join(', ')}`;

    const isHOD = recipient?.professionRole.includes('hod');
    const salutation = isHOD ? 'Respected Sir/Madam' : 'Dear Sir/Madam';
    const closing = letterType === 'leave' ? 'Yours sincerely' : 'Yours obediently';

    let header = `${profileDetails?.name}\n${profileDetails?.deptAndSection || ''}\n${profileDetails?.rollNumber || ''}\n`;
    if (profileDetails?.isHosteller === 'yes' && profileDetails?.hostelName) {
      header += `${profileDetails?.hostelName}\n`;
    }
    header += `Mepco Schlenk Engineering College\nSivakasi\n\n${letterDate}\n\n`;

    const recipientRole = recipient?.professionRole[0] ? `The ${recipient?.professionRole[0].charAt(0).toUpperCase() + recipient?.professionRole[0].slice(1)}` : 'The Staff';
    const recipientBlock = `${recipient?.name}\n${recipientRole}\nMepco Schlenk Engineering College\nSivakasi\n\n${salutation},\n\n`;

    let content = header + recipientBlock;
    let filename = `${letterType}_letter_${letterDate}.pdf`;
    let subject = '';

    if (letterType === 'leave') {
      subject = 'Requisition for leave -reg';
      const start = new Date(startDate);
      const end = new Date(endDate);
      const timeDiff = end - start;
      const noOfDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
      content += `Sub: ${subject}\n\nI am writing to formally request a leave of absence from ${startDate} to ${endDate}. Due to ${reason}, I will be unable to attend class during this period. I request you to grant me leave for ${noOfDays} days.\n\nThank You\n\n${closing},\n${profileDetails?.name}`;
    } else if (letterType === 'internship') {
      subject = 'Requisition for Permission for Attending Internship - Reg';
      content += `Sub: ${subject}\n\nI would like to inform you that I have received an opportunity to intern at ${companyName}, ${companyLocation} from ${startDate} to ${endDate}. Therefore, I kindly request you to grant me permission to attend this internship.\n\nI assure you that I will adhere to all guidelines and will not misuse this privilege. I believe that this internship will provide me with valuable practical experience and enhance my skills in my field of study.\n\nThank you for your consideration.\n\n${closing},\n${profileDetails?.name}`;
    } else if (letterType === 'laptop') {
      subject = 'Requisition for Permission for Laptop Usage - Reg';
      content += `Sub: ${subject}\n\nI would like to inform you that I need to use a laptop during the study hours from ${startDate} to ${endDate} for the preparation of my exams. Therefore, I kindly request you to grant me permission to use a laptop during the specified study hours.\n\nI assure you that I will not misuse this privilege.\n\nThank you for your consideration.\n\n${closing},\n${profileDetails?.name}`;
    } else if (letterType === 'symposium') {
      subject = 'Requisition for Permission for Attending Symposium - Reg';
      content += `Sub: ${subject}\n\nI would like to inform you that I am scheduled to participate in a symposium at ${collegeName}, ${collegeLocation} on ${date}. Therefore, I kindly request you to grant me permission to attend this symposium.\n\nI assure you that I will adhere to all guidelines and will not misuse this privilege. I believe that attending this event will greatly enhance my knowledge and contribute to my academic growth.\n\nThank you for your consideration.\n\n${closing},\n${profileDetails?.name}`;
    } else if (letterType === 'apology') {
      subject = `Apology for ${reason} - Reg`;
      content += `Sub: ${subject}\n\nI sincerely apologize for ${reason}. I understand that my actions may have caused inconvenience and disappointment, and I take full responsibility for my behavior.\n\nI assure you that I have reflected on this situation and recognize the importance of adhering to the guidelines and expectations set forth by the college. I am committed to learning from this experience and will take the necessary steps to ensure that I do not repeat this mistake in the future.\n\nI value the trust and support of the faculty and my peers, and I am determined to regain your confidence. Thank you for your understanding and patience regarding this matter.\n\n${closing},\n${profileDetails?.name}`;
    } else if (letterType === 'iv') {
      subject = 'Requisition for Permission for Industrial Visit - Reg';
      content += `Sub: ${subject}\n\nI would like to inform you that I am scheduled to participate in an industrial visit to ${location} from ${startDate} to ${endDate}. Therefore, I kindly request you to grant me permission to attend this visit.\n\nI assure you that I will adhere to all guidelines and will not misuse this privilege.\n\nThank you for your consideration.\n\n${closing},\n${profileDetails?.name}`;
    } else {
      content += 'Letter type not supported.\n\n';
    }

    return { content, filename };
  };

  const generatePDF = async (data, signatureData = digitalSignature, isEdited = false) => {
    const content = isEdited ? data.content : generateLetterContent(data).content;
    const filename = isEdited ? data.filename : generateLetterContent(data).filename;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const marginLeft = 20;
    const marginRight = 20;
    const marginTop = 15;
    const pageWidth = 210;
    const pageHeight = 297;
    const textWidth = pageWidth - marginLeft - marginRight;

    doc.setLineWidth(0.5);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);

    const lines = doc.splitTextToSize(content, textWidth);

    let y = marginTop;
    lines.forEach((line) => {
      if (y > pageHeight - 15) {
        doc.addPage();
        y = marginTop;
        doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
      }
      doc.text(line, marginLeft, y);
      y += 7;
    });

    if (signatureData && signatureData.image) {
      y += 14;
      const signatureText = `Signed by ${signatureData.signedBy} on ${new Date(signatureData.signedAt).toLocaleString()}`;
      const signatureLines = doc.splitTextToSize(signatureText, textWidth);
      if (y + signatureLines.length * 7 + 20 > pageHeight - 15) {
        doc.addPage();
        y = marginTop;
        doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
      }
      doc.addImage(signatureData.image, 'PNG', marginLeft, y, 50, 20);
      y += 25;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      signatureLines.forEach((line) => {
        doc.text(line, marginLeft, y);
        y += 7;
      });
    }

    doc.save(filename);

    if (!data.fromHistory && !isEdited) {
      const userId = localStorage.getItem('userId');
      try {
        console.log('Saving letter to backend:', { userId, name: filename, formData: data });
        const response = await axios.post('http://localhost:3008/letters', {
          userId,
          name: filename,
          createdAt: new Date().toISOString(),
          formData: { ...data },
          signatureData: signatureData ? { ...signatureData, signedById: userId } : null,
        });
        console.log('Letter saved successfully:', response.data);
        await fetchLetterHistory();
        toast.success('Letter saved and generated!');
      } catch (error) {
        console.error('Error saving letter to backend:', error.response?.data || error.message);
        toast.error('Failed to save letter to backend.');
      }
      setDigitalSignature(null);
    } else if (isEdited) {
      const userId = localStorage.getItem('userId');
      try {
        console.log('Saving edited letter to backend:', { userId, name: filename, formData: data });
        const response = await axios.post('http://localhost:3008/letters', {
          userId,
          name: filename,
          createdAt: new Date().toISOString(),
          formData: { ...data, editedContent: content },
          signatureData: signatureData ? { ...signatureData, signedById: userId } : null,
        });
        console.log('Edited letter saved successfully:', response.data);
        await fetchLetterHistory();
        toast.success('Edited letter saved and generated!');
      } catch (error) {
        console.error('Error saving edited letter to backend:', error.response?.data || error.message);
        toast.error('Failed to save edited letter to backend.');
      }
      setDigitalSignature(null);
    }
  };

  const handleGenerateAndEdit = () => {
    const { content, filename } = generateLetterContent(formData);
    setLetterContent(content);
    setGeneratedLetterData({ ...formData, filename });
    setIsEditingLetter(true);
  };

  const handleSaveEditedLetter = () => {
    generatePDF(
      { content: letterContent, filename: generatedLetterData.filename, originalData: generatedLetterData },
      digitalSignature,
      true
    );
    setIsEditingLetter(false);
    setLetterContent('');
    setGeneratedLetterData(null);
  };

  const handleCancelEditLetter = () => {
    setIsEditingLetter(false);
    setLetterContent('');
    setGeneratedLetterData(null);
  };

  const handleDownloadLetter = async (letterId) => {
    try {
      const response = await axios.get(`http://localhost:3008/letters/download/${letterId}`);
      const letter = response.data;
      if (letter.formData.editedContent) {
        generatePDF(
          { content: letter.formData.editedContent, filename: letter.name, originalData: letter.formData },
          letter.signatureData,
          true
        );
      } else {
        generatePDF({ ...letter.formData, fromHistory: true }, letter.signatureData);
      }
      toast.success('Letter downloaded successfully!');
    } catch (error) {
      console.error('Error downloading letter:', error);
      toast.error('Failed to download letter.');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isUserMenuOpen && !event.target.closest('.user-menu')) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (collegeMailId) {
      fetchProfile();
    } else {
      setErrorProfile('College Mail ID not found in local storage.');
      setLoadingProfile(false);
      toast.error('College Mail ID not found.');
    }
  }, [collegeMailId]);

  useEffect(() => {
    if (profileDetails) {
      fetchRecipients();
      fetchLetterHistory();
    }
  }, [profileDetails]);

  const isStaff = profileDetails && !profileDetails.professionRole.includes('student');

  if (loadingProfile) {
    return (
      <div className="container">
        <div className="box has-text-centered">
          <p className="is-size-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (errorProfile) {
    return (
      <div className="container">
        <div className="box has-text-centered">
          <p className="is-size-4 has-text-danger">{errorProfile}</p>
        </div>
      </div>
    );
  }

  if (!profileDetails) {
    return (
      <div className="container">
        <div className="box has-text-centered">
          <p className="is-size-4">No profile information found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hero is-fullheight">
      <Toaster position="top-right" reverseOrder={false} />
      <div className="hero-head">
        <nav className="navbar" style={{ backgroundColor: '#002f6c', padding: '1rem' }}>
          <div className="navbar-brand">
            <div className="navbar-item title is-2 has-text-white">LeGen</div>
          </div>
          <div className="navbar-menu">
            <div className="navbar-start">
              <a className="navbar-item has-text-white" onClick={() => handleViewChange('yourLetters')}>
                Your Letters
              </a>
              {!isStaff && (
                <a className="navbar-item has-text-white" onClick={() => handleViewChange('letterGenerator')}>
                  Letter Generator
                </a>
              )}
              <a className="navbar-item has-text-white" onClick={() => handleViewChange('gmail')}>
                Gmail
              </a>
            </div>
            <div className="navbar-end">
              <div className="navbar-item">
                <div className="user-menu relative">
                  <button className="button is-light" onClick={handleUserMenuToggle}>
                    <i className="fas fa-user-circle" aria-hidden="true"></i>
                  </button>
                  {isUserMenuOpen && (
                    <div className="dropdown is-active is-right">
                      <div className="dropdown-menu" style={{ right: 0, left: 'auto', minWidth: '150px' }}>
                        <div className="dropdown-content">
                          <a className="dropdown-item" onClick={() => handleViewChange('profileView')}>
                            Profile
                          </a>
                          <a className="dropdown-item" onClick={() => handleEditProfile()}>
                            Modify Profile
                          </a>
                          <a
                            className="dropdown-item"
                            onClick={() => {
                              localStorage.removeItem('userCollegeId');
                              navigate('/login');
                              setIsUserMenuOpen(false);
                            }}
                          >
                            Logout
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <div className="hero-body">
        <div className="container">
          {!isStaff && view === 'letterGenerator' && !isEditingLetter && (
            <div className="box has-background-white-ter">
              <h2 className="title is-2">Letter Generator</h2>
              <div className="columns">
                <div className="column is-full">
                  <div className="field">
                    <label className="label">Sender Name</label>
                    <div className="control">
                      <input className="input" type="text" value={profileDetails?.name || ''} disabled />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">{profileDetails?.professionRole.includes('student') ? 'Roll Number' : 'Role'}</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        value={profileDetails?.professionRole.includes('student') ? profileDetails?.rollNumber : profileDetails?.professionRole.join(', ')}
                        disabled
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Recipient</label>
                    <div className="control">
                      <div className="select is-fullwidth">
                        <select name="recipientId" value={formData.recipientId} onChange={handleFormChange}>
                          <option value="">Select Recipient</option>
                          {recipients.map((recipient) => (
                            <option key={recipient._id} value={recipient._id}>
                              {recipient.name} ({recipient.professionRole.includes('student') ? 'Student' : recipient.professionRole.join(', ')})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Letter Type</label>
                    <div className="control">
                      <div className="select is-fullwidth">
                        <select name="letterType" value={formData.letterType} onChange={handleFormChange}>
                          <option value="leave">Leave Letter</option>
                          <option value="internship">Internship Permission Letter</option>
                          <option value="laptop">Laptop Permission Letter</option>
                          <option value="symposium">Symposium Permission Letter</option>
                          <option value="apology">Apology Letter</option>
                          <option value="iv">IV Permission Letter</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  {formData.letterType === 'leave' && (
                    <>
                      <div className="field">
                        <label className="label">Start Date</label>
                        <div className="control">
                          <input
                            className="input"
                            type="date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleFormChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">End Date</label>
                        <div className="control">
                          <input
                            className="input"
                            type="date"
                            name="endDate"
                            value={formData.endDate}
                            onChange={handleFormChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">Reason</label>
                        <div className="control">
                          <input
                            className="input"
                            type="text"
                            name="reason"
                            value={formData.reason}
                            onChange={handleFormChange}
                            placeholder="e.g., personal reasons"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {formData.letterType === 'internship' && (
                    <>
                      <div className="field">
                        <label className="label">Start Date</label>
                        <div className="control">
                          <input
                            className="input"
                            type="date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleFormChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">End Date</label>
                        <div className="control">
                          <input
                            className="input"
                            type="date"
                            name="endDate"
                            value={formData.endDate}
                            onChange={handleFormChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">Company Name</label>
                        <div className="control">
                          <input
                            className="input"
                            type="text"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleFormChange}
                            placeholder="e.g., TechCorp"
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">Company Location</label>
                        <div className="control">
                          <input
                            className="input"
                            type="text"
                            name="companyLocation"
                            value={formData.companyLocation}
                            onChange={handleFormChange}
                            placeholder="e.g., Chennai, Tamil Nadu"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {formData.letterType === 'laptop' && (
                    <>
                      <div className="field">
                        <label className="label">Start Date</label>
                        <div className="control">
                          <input
                            className="input"
                            type="date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleFormChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">End Date</label>
                        <div className="control">
                          <input
                            className="input"
                            type="date"
                            name="endDate"
                            value={formData.endDate}
                            onChange={handleFormChange}
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {formData.letterType === 'symposium' && (
                    <>
                      <div className="field">
                        <label className="label">College Name</label>
                        <div className="control">
                          <input
                            className="input"
                            type="text"
                            name="collegeName"
                            value={formData.collegeName}
                            onChange={handleFormChange}
                            placeholder="e.g., Anna University"
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">College Location</label>
                        <div className="control">
                          <input
                            className="input"
                            type="text"
                            name="collegeLocation"
                            value={formData.collegeLocation}
                            onChange={handleFormChange}
                            placeholder="e.g., Chennai, Tamil Nadu"
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">Date</label>
                        <div className="control">
                          <input
                            className="input"
                            type="date"
                            name="date"
                            value={formData.date}
                            onChange={handleFormChange}
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {formData.letterType === 'apology' && (
                    <div className="field">
                      <label className="label">Reason</label>
                      <div className="control">
                        <input
                          className="input"
                          type="text"
                          name="reason"
                          value={formData.reason}
                          onChange={handleFormChange}
                          placeholder="e.g., missing a deadline"
                          required
                        />
                      </div>
                    </div>
                  )}
                  {formData.letterType === 'iv' && (
                    <>
                      <div className="field">
                        <label className="label">Start Date</label>
                        <div className="control">
                          <input
                            className="input"
                            type="date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleFormChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">End Date</label>
                        <div className="control">
                          <input
                            className="input"
                            type="date"
                            name="endDate"
                            value={formData.endDate}
                            onChange={handleFormChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label className="label">Location</label>
                        <div className="control">
                          <input
                            className="input"
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleFormChange}
                            placeholder="e.g., ISRO, Sriharikota"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="field">
                    <div className="control">
                      <button className="button is-primary" onClick={handleGenerateAndEdit} style={{ marginRight: '1rem' }}>
                        Generate & Edit
                      </button>
                      <button className="button is-success" onClick={() => generatePDF(formData)}>
                        Generate & Download PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isStaff && view === 'letterGenerator' && isEditingLetter && (
            <div className="box has-background-white-ter">
              <h2 className="title is-2">Edit Letter</h2>
              <div className="field">
                <label className="label">Letter Content</label>
                <div className="control">
                  <textarea
                    className="textarea"
                    value={letterContent}
                    onChange={(e) => setLetterContent(e.target.value)}
                    rows={20}
                    style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '12px' }}
                  />
                </div>
              </div>
              <div className="field is-grouped">
                <div className="control">
                  <button className="button is-primary" onClick={handleSaveEditedLetter}>
                    Save Changes & Download
                  </button>
                </div>
                <div className="control">
                  <button className="button is-light" onClick={handleCancelEditLetter}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'yourLetters' && (
            <div className="box has-background-white-ter">
              <h2 className="title is-2">Your Letters</h2>
              {letterHistory.length > 0 ? (
                <table className="table is-fullwidth is-striped">
                  <thead>
                    <tr>
                      <th style={{ color: 'black' }}>File Name</th>
                      <th style={{ color: 'black' }}>Date</th>
                      <th style={{ color: 'black' }}>Signed</th>
                      <th style={{ color: 'black' }}>Signed By</th>
                      <th style={{ color: 'black' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {letterHistory.map((letter) => (
                      <tr key={letter._id}>
                        <td>{letter.name}</td>
                        <td>{new Date(letter.createdAt).toLocaleDateString()}</td>
                        <td>{letter.signatureData ? 'Yes' : 'No'}</td>
                        <td>{letter.signatureData?.signedBy || '-'}</td>
                        <td>
                          <button
                            className="button is-small is-primary"
                            onClick={() => handleDownloadLetter(letter._id)}
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No letters {isStaff ? 'received or signed' : 'generated'} yet.</p>
              )}
            </div>
          )}

          {view === 'gmail' && (
            <div className="box has-background-white-ter">
              <h2 className="title is-2">Gmail</h2>
              {emailError && <div className="notification is-danger">{emailError}</div>}
              <div className="columns">
                <div className="column is-4">
                  <h3 className="subtitle is-4">Compose Email</h3>
                  <div className="field">
                    <label className="label">From</label>
                    <div className="control">
                      <input className="input" type="email" name="from" value={emailForm.from} disabled />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">To</label>
                    <div className="control">
                      <input
                        className="input"
                        type="email"
                        name="to"
                        value={emailForm.to}
                        onChange={handleEmailFormChange}
                        placeholder="Recipient's email"
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Subject</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        name="subject"
                        value={emailForm.subject}
                        onChange={handleEmailFormChange}
                        placeholder="Email subject"
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Message</label>
                    <div className="control">
                      <textarea
                        className="textarea"
                        name="message"
                        value={emailForm.message}
                        onChange={handleEmailFormChange}
                        placeholder="Write your message here"
                        rows={5}
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Attach PDF</label>
                    <div className="control">
                      <input
                        className="input"
                        type="file"
                        name="file"
                        accept="application/pdf"
                        onChange={handleEmailFormChange}
                      />
                    </div>
                    {emailForm.file && <p className="help">{emailForm.file.name}</p>}
                  </div>
                  <div className="field">
                    <div className="control">
                      <button
                        className={`button is-primary ${emailLoading ? 'is-loading' : ''}`}
                        onClick={handleSendEmail}
                        disabled={emailLoading}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
                <div className="column is-8">
                  <h3 className="subtitle is-4">Inbox</h3>
                  {emailLoading ? (
                    <p>Loading emails...</p>
                  ) : emails.length > 0 ? (
                    <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
                      <table className="table is-fullwidth is-hoverable gmail-table">
                        <thead>
                          <tr>
                            <th>From</th>
                            <th>Subject</th>
                            <th>Preview</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emails.map((email) => (
                            <tr key={email._id} className="is-clickable" onClick={() => handleEmailClick(email)}>
                              <td>{email.from}</td>
                              <td>{email.subject}</td>
                              <td>{email.message.slice(0, 50)}...</td>
                              <td>{new Date(email.sentAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No emails found.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedEmail && (
            <div className="modal is-active">
              <div className="modal-background" onClick={handleCloseEmail}></div>
              <div className="modal-content" style={{ maxWidth: '90vw' }}>
                <div className="box">
                  <h3 className="title is-4">{selectedEmail.subject}</h3>
                  <div className="content">
                    <p><strong>From:</strong> {selectedEmail.from}</p>
                    <p><strong>To:</strong> {selectedEmail.to}</p>
                    <p><strong>Date:</strong> {new Date(selectedEmail.sentAt).toLocaleString()}</p>
                    <p><strong>Message:</strong></p>
                    <div className="email-body">{selectedEmail.message}</div>
                    {selectedEmail.pdfName && (
                      <div>
                        <p><strong>Attachment:</strong> {selectedEmail.pdfName}</p>
                        <button
                          className="button is-primary"
                          onClick={() => handleDownloadAttachment(selectedEmail)}
                        >
                          Download Attachment
                        </button>
                      </div>
                    )}
                  </div>
                  <button className="button is-light" onClick={handleCloseEmail} style={{ marginTop: '1rem' }}>
                    Close
                  </button>
                </div>
              </div>
              <button className="modal-close is-large" aria-label="close" onClick={handleCloseEmail}></button>
            </div>
          )}

          {isCanvasOpen && isStaff && (
            <div className="modal is-active">
              <div className="modal-background" onClick={() => setIsCanvasOpen(false)}></div>
              <div className="modal-content" style={{ maxWidth: '90vw' }}>
                <div className="box">
                  <h3 className="title is-4">Draw Your Signature</h3>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={200}
                    style={{ border: '1px solid #000', backgroundColor: '#fff' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                  />
                  <div className="field is-grouped" style={{ marginTop: '1rem' }}>
                    <div className="control">
                      <button className="button is-primary" onClick={saveSignature}>
                        Save Signature
                      </button>
                    </div>
                    <div className="control">
                      <button className="button is-light" onClick={clearCanvas}>
                        Clear
                      </button>
                    </div>
                    <div className="control">
                      <button className="button is-danger" onClick={() => setIsCanvasOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(view === 'profileView' || view === 'profileEdit') && (
            <div className="box has-background-white-ter">
              <h2 className="title is-2">{view === 'profileView' ? 'Profile Details' : 'Modify Profile'}</h2>
              {view === 'profileEdit' ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
                  <div className="field">
                    <label className="label">Name</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        name="name"
                        value={tempProfileDetails?.name || ''}
                        onChange={handleProfileInputChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Email</label>
                    <div className="control">
                      <input
                        className="input"
                        type="email"
                        name="email"
                        value={tempProfileDetails?.email || ''}
                        onChange={handleProfileInputChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">College Mail ID</label>
                    <div className="control">
                      <input
                        className="input"
                        type="email"
                        name="collegeMailId"
                        value={tempProfileDetails?.collegeMailId || ''}
                        onChange={handleProfileInputChange}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Profession Role</label>
                    <div className="control">
                      {Array.isArray(tempProfileDetails?.professionRole) &&
                        tempProfileDetails.professionRole.map((role, index) => (
                          <input
                            key={index}
                            className="input"
                            type="text"
                            name={`professionRole[${index}]`}
                            value={role || ''}
                            onChange={handleProfileInputChange}
                            style={{ marginBottom: '0.5rem' }}
                          />
                        ))}
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Department & Section</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        name="deptAndSection"
                        value={tempProfileDetails?.deptAndSection || ''}
                        onChange={handleProfileInputChange}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Department</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        name="department"
                        value={tempProfileDetails?.department || ''}
                        onChange={handleProfileInputChange}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Is Hosteller</label>
                    <div className="control">
                      <div className="select">
                        <select
                          name="isHosteller"
                          value={tempProfileDetails?.isHosteller || ''}
                          onChange={handleProfileInputChange}
                        >
                          <option value="">Select</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  {tempProfileDetails?.isHosteller === 'yes' && (
                    <div className="field">
                      <label className="label">Hostel Name</label>
                      <div className="control">
                        <input
                          className="input"
                          type="text"
                          name="hostelName"
                          value={tempProfileDetails?.hostelName || ''}
                          onChange={handleProfileInputChange}
                        />
                      </div>
                    </div>
                  )}
                  <div className="field">
                    <label className="label">Roll Number</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        name="rollNumber"
                        value={tempProfileDetails?.rollNumber || ''}
                        onChange={handleProfileInputChange}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <div className="control">
                      <button type="submit" className="button is-primary">
                        Save Changes
                      </button>
                      <button
                        type="button"
                        className="button is-light"
                        onClick={handleCancelEdit}
                        style={{ marginLeft: '1rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="content">
                  <p><strong className="has-text-weight-bold">Name:</strong> {profileDetails?.name}</p>
                  <p><strong>Email:</strong> {profileDetails?.email}</p>
                  <p><strong>College Mail ID:</strong> {profileDetails?.collegeMailId}</p>
                  <p>
                    <strong>Profession Role:</strong>{' '}
                    {Array.isArray(profileDetails?.professionRole) ? profileDetails.professionRole.join(', ') : ''}
                  </p>
                  <p><strong>Department & Section:</strong> {profileDetails?.deptAndSection}</p>
                  <p><strong>Department:</strong> {profileDetails?.department}</p>
                  <p><strong>Is Hosteller:</strong> {profileDetails?.isHosteller}</p>
                  {profileDetails?.isHosteller === 'yes' && (
                    <p><strong>Hostel Name:</strong> {profileDetails?.hostelName}</p>
                  )}
                  <p><strong>Roll Number:</strong> {profileDetails?.rollNumber}</p>
                  <button className="button is-info" onClick={() => handleEditProfile()} style={{ marginTop: '1rem' }}>
                    Edit Profile
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;