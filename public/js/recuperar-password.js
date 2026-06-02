document.addEventListener('DOMContentLoaded', () => {
    const stepContainers = {
        1: document.getElementById('step-1'),
        2: document.getElementById('step-2'),
        3: document.getElementById('step-3'),
        success: document.getElementById('step-success'),
    };
    const dots = {
        1: document.getElementById('dot-1'),
        2: document.getElementById('dot-2'),
        3: document.getElementById('dot-3'),
    };
    const emailInput = document.getElementById('recovery-email');
    const btnSendCode = document.getElementById('btn-send-code');
    const msgStep1 = document.getElementById('msg-step1');
    const displayEmail = document.getElementById('display-email');
    const otpInputs = document.querySelectorAll('.otp-input');
    const btnVerifyCode = document.getElementById('btn-verify-code');
    const msgStep2 = document.getElementById('msg-step2');
    const btnResend = document.getElementById('btn-resend');
    const resendTimer = document.getElementById('resend-timer');
    const countdownEl = document.getElementById('countdown');
    const newPassword = document.getElementById('new-password');
    const confirmPassword = document.getElementById('confirm-password');
    const toggleNew = document.getElementById('toggle-new');
    const toggleConfirm = document.getElementById('toggle-confirm');
    const reqLength = document.getElementById('req-length');
    const reqMatch = document.getElementById('req-match');
    const btnUpdatePass = document.getElementById('btn-update-password');
    const msgStep3 = document.getElementById('msg-step3');
    const cardIcon = document.getElementById('card-icon');

    let currentStep = 1;
    let recoveryEmail = '';
    let countdownInterval = null;

    const setLoading = (btn, state) => {
        const spinner = btn.querySelector('.spinner');
        const btnText = btn.querySelector('.btn-text');
        btn.disabled = state;
        spinner.classList.toggle('hidden', !state);
        btnText.style.visibility = state ? 'hidden' : 'visible';
    };

    const showStep = (step) => {
        Object.values(stepContainers).forEach(el => el.classList.remove('active'));
        const map = { 1: stepContainers[1], 2: stepContainers[2], 3: stepContainers[3], success: stepContainers.success };
        if (step === 'success') {
            map.success.classList.add('active');
            dots[3].classList.add('completed');
            cardIcon.className = 'fa-solid fa-check';
            cardIcon.style.color = '#10b981';
            return;
        }
        map[step].classList.add('active');
        currentStep = step;
        for (let i = 1; i <= 3; i++) {
            dots[i].classList.toggle('active', i === step);
            dots[i].classList.toggle('completed', i < step);
        }
    };

    const startCountdown = () => {
        let seconds = 60;
        btnResend.style.display = 'none';
        resendTimer.style.display = 'block';
        countdownEl.textContent = seconds;
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            seconds--;
            countdownEl.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(countdownInterval);
                resendTimer.style.display = 'none';
                btnResend.style.display = 'inline';
            }
        }, 1000);
    };

    const resetCountdown = () => {
        clearInterval(countdownInterval);
        resendTimer.style.display = 'none';
        btnResend.style.display = 'none';
    };

    // ========== PASO 1: Validar correo y enviar código ==========
    btnSendCode.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        if (!email) {
            msgStep1.textContent = 'Ingresa tu correo electrónico.';
            msgStep1.className = 'recovery-msg error';
            return;
        }
        setLoading(btnSendCode, true);
        msgStep1.textContent = '';
        msgStep1.className = 'recovery-msg';

        try {
            const { data: existe, error: checkErr } = await supabaseClient.rpc('check_email_exists', {
                email_in: email
            });

            if (checkErr) throw checkErr;
            if (!existe || existe.length === 0) {
                msgStep1.textContent = 'Este correo no está registrado en el sistema.';
                msgStep1.className = 'recovery-msg error';
                setLoading(btnSendCode, false);
                return;
            }

            const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
            if (error) throw error;
            recoveryEmail = email;
            displayEmail.textContent = email;
            msgStep1.textContent = 'Código enviado. Revisa tu bandeja de entrada.';
            msgStep1.className = 'recovery-msg success';
            showStep(2);
            startCountdown();
        } catch (err) {
            msgStep1.textContent = err.message || 'Error al enviar el código.';
            msgStep1.className = 'recovery-msg error';
        } finally {
            setLoading(btnSendCode, false);
        }
    });

    // ========== PASO 2: Verificar OTP ==========
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val && !/^\d$/.test(val)) {
                e.target.value = '';
                return;
            }
            e.target.value = val.slice(0, 1);
            if (val && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            updateOtpState();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
            updateOtpState();
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            const digits = paste.replace(/\D/g, '').slice(0, 8);
            digits.split('').forEach((d, i) => {
                if (i < otpInputs.length) {
                    otpInputs[i].value = d;
                    otpInputs[i].classList.add('filled');
                }
            });
            const focusIdx = Math.min(digits.length, otpInputs.length - 1);
            otpInputs[focusIdx].focus();
            updateOtpState();
        });
    });

    const updateOtpState = () => {
        const allFilled = Array.from(otpInputs).every(inp => inp.value.length === 1);
        btnVerifyCode.disabled = !allFilled;
        otpInputs.forEach(inp => {
            inp.classList.toggle('filled', inp.value.length === 1);
        });
    };

    btnVerifyCode.addEventListener('click', async () => {
        const token = Array.from(otpInputs).map(inp => inp.value).join('');
        if (token.length !== 8) return;

        setLoading(btnVerifyCode, true);
        msgStep2.textContent = '';
        msgStep2.className = 'recovery-msg';

        try {
            const { error } = await supabaseClient.auth.verifyOtp({
                email: recoveryEmail,
                token,
                type: 'recovery',
            });
            if (error) throw error;
            resetCountdown();
            showStep(3);
        } catch (err) {
            msgStep2.textContent = err.message || 'Código incorrecto.';
            msgStep2.className = 'recovery-msg error';
        } finally {
            setLoading(btnVerifyCode, false);
        }
    });

    btnResend.addEventListener('click', async () => {
        setLoading(btnResend, true);
        try {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(recoveryEmail);
            if (error) throw error;
            startCountdown();
            msgStep2.textContent = 'Código reenviado.';
            msgStep2.className = 'recovery-msg success';
        } catch (err) {
            msgStep2.textContent = err.message || 'Error al reenviar.';
            msgStep2.className = 'recovery-msg error';
        } finally {
            setLoading(btnResend, false);
        }
    });

    // ========== PASO 3: Nueva contraseña ==========
    const togglePass = (input, btn) => {
        const icon = btn.querySelector('i');
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    };

    toggleNew.addEventListener('click', () => togglePass(newPassword, toggleNew));
    toggleConfirm.addEventListener('click', () => togglePass(confirmPassword, toggleConfirm));

    const validatePasswords = () => {
        const pass = newPassword.value;
        const confirm = confirmPassword.value;
        const lengthOk = pass.length >= 6;
        const matchOk = pass.length > 0 && pass === confirm;

        reqLength.classList.toggle('valid', lengthOk);
        reqMatch.classList.toggle('valid', matchOk);
        reqLength.querySelector('i').className = lengthOk ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle';
        reqMatch.querySelector('i').className = matchOk ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle';

        btnUpdatePass.disabled = !(lengthOk && matchOk);
    };

    newPassword.addEventListener('input', validatePasswords);
    confirmPassword.addEventListener('input', validatePasswords);

    btnUpdatePass.addEventListener('click', async () => {
        setLoading(btnUpdatePass, true);
        msgStep3.textContent = '';
        msgStep3.className = 'recovery-msg';

        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword.value,
            });
            if (error) throw error;
            showStep('success');
            setTimeout(() => {
                window.location.href = 'index.html?reset=ok';
            }, 3000);
        } catch (err) {
            msgStep3.textContent = err.message || 'Error al actualizar la contraseña.';
            msgStep3.className = 'recovery-msg error';
        } finally {
            setLoading(btnUpdatePass, false);
        }
    });
});
