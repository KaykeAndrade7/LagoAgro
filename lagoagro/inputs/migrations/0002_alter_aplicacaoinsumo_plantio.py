from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inputs', '0001_initial'),
        ('plantings', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='aplicacaoinsumo',
            name='plantio',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='aplicacoes',
                to='plantings.plantio',
            ),
        ),
    ]
