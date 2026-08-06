from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0006_lancamentofinanceiro_tipo_and_more'),
        ('plantings', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='diaria',
            name='lancamento',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='diarias_pagas',
                to='finance.lancamentofinanceiro',
            ),
        ),
        migrations.AlterField(
            model_name='diaria',
            name='plantio',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='diarias',
                to='plantings.plantio',
            ),
        ),
        migrations.AlterField(
            model_name='diaria',
            name='trabalhador',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='diarias',
                to='finance.trabalhador',
            ),
        ),
        migrations.AlterField(
            model_name='lancamentofinanceiro',
            name='plantio',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='lancamentos',
                to='plantings.plantio',
            ),
        ),
    ]
